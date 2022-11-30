import * as fs from 'fs';
import * as path from 'path';
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

export function findUp(ext: string, directory: string = process.cwd()): string | undefined {
  const absoluteDirectory = path.resolve(directory);

  const file = fs.readdirSync(absoluteDirectory).find((file) => file.endsWith(ext))
  if (file) {
    return path.join(absoluteDirectory, file);
  }
  
  const { root } = path.parse(absoluteDirectory);
  return absoluteDirectory == root ? undefined : findUp(ext, path.dirname(absoluteDirectory));
}
