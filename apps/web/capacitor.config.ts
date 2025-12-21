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
        }
    }
};

export default config;
