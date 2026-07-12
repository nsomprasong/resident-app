const requiredPublicEnvironment = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

export function getSupabasePublicEnvironment() {
  if (!requiredPublicEnvironment.url || !requiredPublicEnvironment.publishableKey) {
    throw new Error(
      "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    url: requiredPublicEnvironment.url,
    publishableKey: requiredPublicEnvironment.publishableKey,
  };
}
