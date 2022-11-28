import { spawnSync, SpawnSyncOptions } from "child_process";

export function getDotNetLambdaTools(): boolean | undefined {
  try {
    const dotnet = spawnSync('dotnet', ['lambda', '--help']);
    if (dotnet.status !== 0 || dotnet.error) {
      return undefined;
    }
    return true;
  } catch (err) {
    return undefined;
  }
}

export function exec(cmd: string, args: string[], options?: SpawnSyncOptions) {
  const proc = spawnSync(cmd, args, options);

  if (proc.error) {
    throw proc.error;
  }

  if (proc.status !== 0) {
    if (proc.stdout || proc.stderr) {
      throw new Error(`[Status ${proc.status}] stdout: ${proc.stdout?.toString().trim()}\n\n\nstderr: ${proc.stderr?.toString().trim()}`);
    }
    throw new Error(`${cmd} exited with status ${proc.status}`);
  }

  return proc;
}