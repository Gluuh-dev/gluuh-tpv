// Expo inyecta las variables EXPO_PUBLIC_* en process.env (Metro). Tipado para TS.
declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    [key: string]: string | undefined;
  };
};
