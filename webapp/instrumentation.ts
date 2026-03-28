export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { mergeParentEnvLocalIntoProcess } = await import(
    "./lib/merge-parent-env-local"
  );
  mergeParentEnvLocalIntoProcess();
}
