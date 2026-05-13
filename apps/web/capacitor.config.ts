import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.spendigo.smartcart',
    appName: 'Spendigo',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    },
    plugins: {
        StatusBar: {
            style: 'DARK',
            overlaysWebView: true,
            backgroundColor: '#ffffffff'
        },
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: '#ffffff',
            showSpinner: false,
            androidScaleType: 'CENTER_CROP',
            splashFullScreen: true,
            splashImmersive: true
        },
        Keyboard: {
            resize: 'body',
            style: 'DARK',
            scrollToInput: true
        },
        GoogleAuth: {
            scopes: ['profile', 'email'],
            iosClientId: '1012948918368-4rj59baf5id95r7t6ob5pcinrcb14j35.apps.googleusercontent.com',
            serverClientId: '1012948918368-m29pbhj6nqvdpeda77vd19t6et3thn2u.apps.googleusercontent.com',
            forceCodeForRefreshToken: true
        }
    }
};

export default config;
