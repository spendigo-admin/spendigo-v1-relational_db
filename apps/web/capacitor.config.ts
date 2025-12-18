import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.spendigo.smartcart',
    appName: 'Spendigo',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    }
};

export default config;
