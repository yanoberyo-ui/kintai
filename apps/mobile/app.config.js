export default {
  expo: {
    name: "FDGroup勤怠管理",
    slug: "fdgroup-kintai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",

    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },

    updates: {
      fallbackToCacheTimeout: 0
    },

    assetBundlePatterns: [
      "**/*"
    ],

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.fdgroup.kintai"
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.fdgroup.kintai"
    },

    extra: {
      supabaseUrl: process.env.VITE_SUPABASE_URL,
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
    }
  }
};
