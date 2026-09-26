import { createContext } from 'react';

// Keep provider and consumers on the same context across live module updates.
const LanguageContext = import.meta.hot?.data.languageContext ?? createContext(null);
if (import.meta.hot) {
  import.meta.hot.data.languageContext = LanguageContext;
}

export default LanguageContext;