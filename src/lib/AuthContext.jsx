import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { getHomePath } from '@/lib/menuPermissions';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const claimAttempt = useRef(null);
  const [onboardingPath, setOnboardingPath] = useState(null);
  const completeOnboarding = useCallback(() => setOnboardingPath(null), []);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // Ask the auth service even when no URL/local-storage token is present.
        await checkUserAuth();
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            // Authentication must precede invitation claiming; never recursively bootstrap.
            const authenticated = await checkUserAuth();
            if (!authenticated) setAuthError({ type: 'auth_required', message: '로그인이 필요합니다.' });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    let currentUser = null;
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      currentUser = await base44.auth.me();
      if (!currentUser.account_tier) {
        // One claim per authenticated identity, including concurrent auth checks.
        if (claimAttempt.current?.id !== currentUser.id) {
          claimAttempt.current = { id: currentUser.id, promise: base44.functions.invoke('claimInvitation', {}) };
        }
        const { data } = await claimAttempt.current.promise;
        if (data?.error || !data?.ok) throw new Error(data?.error || '초대 정보를 적용하지 못했습니다.');
        currentUser = await base44.auth.me();
        if (currentUser.account_tier) setOnboardingPath(getHomePath(currentUser));
        else setAuthError({ type: 'user_not_registered', message: '이 이메일에 적용할 초대가 없습니다. 초대받은 이메일로 로그인했는지 확인해주세요.' });
      }
      setUser(currentUser);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError({ type: 'invitation_error', message: error.response?.data?.error || error.data?.error || error.message || '초대를 적용하지 못했습니다.' });
        return true;
      }
      setUser(null);
      setIsAuthenticated(false);
      const status = error.status || error.response?.status;
      if (status === 401 || status === 403) {
        if (appParams.token || appParams.invitationEntry || window.location.pathname !== '/') {
          setAuthError({ type: 'auth_required', message: '로그인이 필요합니다.' });
        }
      } else {
        setAuthError({ type: 'unknown', message: '로그인 정보를 확인하지 못했습니다. 다시 시도해주세요.' });
      }
      return false;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const retryInvitation = () => {
    claimAttempt.current = null;
    return checkUserAuth();
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      onboardingPath,
      completeOnboarding,
      retryInvitation,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};