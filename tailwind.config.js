/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
      // 글자 역할: 공개 사이트(랜딩)와 같은 크기 체계. 새 화면은 임의 px 대신 이 이름을 쓴다.
      //  micro 11 — 배지·칩만 / caption 12.5 — 보조 설명·메타 / label 13 — 입력 이름·표·작은 버튼 / body 14.5 — 본문·값 / title 18 — 구역·창 제목
      fontSize: {
        micro: ['11px', { lineHeight: '16px' }],
        caption: ['12.5px', { lineHeight: '18px' }],
        label: ['13px', { lineHeight: '20px' }],
        body: ['14.5px', { lineHeight: '23px' }],
        title: ['18px', { lineHeight: '26px', letterSpacing: '-0.5px' }],
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        landing: ['var(--font-landing)'],
      },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			// 주의(경고): warning 은 아이콘·옅은 배경, warning-text 는 흰 바탕에서 읽히는 글자색
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				text: 'hsl(var(--warning-text))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			// 공개 랜딩 전용 고정 팔레트 (앱 테마와 분리)
  			landing: {
  				brand: '#0066FF',
  				'brand-hover': '#005EEB',
  				'brand-deep': '#0047B8',
  				tint: '#EAF2FE',
  				'tint-border': '#C6DBFE',
  				'tint-soft': '#F2F7FF',
  				ink: '#171719',
  				ink2: '#37383C',
  				ink3: '#46474C',
  				muted: '#70737C',
  				muted2: '#989BA2',
  				muted3: '#AEB0B6',
  				line: '#EAEBEC',
  				line2: '#E4E4E6',
  				line3: '#DBDCDF',
  				page: '#F7F7F8',
  				input: '#FAFAFB',
  				toggle: '#F1F0F5',
  				'dark-card': '#232427',
  				'dark-line': '#35363A',
  				'dark-body': '#C2C4C8',
  				'dark-accent': '#7FAFFF',
  				lite: '#0F9F8F',
  				'lite-text': '#0B8A7C',
  				'lite-tint': '#E9F7F5',
  				'lite-line': '#A8DFD7',
  				pro: '#6A4CE0',
  				'pro-text': '#5B3FD6',
  				'pro-tint': '#F1EEFD',
  				'pro-line': '#D3C9F8',
  				'ent-accent': '#E2B54A',
  				danger: '#B9464B',
  				'danger-bg': '#FDEDED',
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
