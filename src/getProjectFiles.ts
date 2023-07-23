import { promisify } from 'util';
import childProcess from 'child_process';

const exec = promisify(childProcess.exec);

export default async function getProjectFiles(directory: string, ignoredPaths: readonly string[]): Promise<string[]> {
  const options = { cwd: directory, maxBuffer: 10 * 1024 * 1024 };
  const data = (await exec('git ls-files --cached --others --exclude-standard', options)).stdout;

  return data.trim().split('\n').filter((path) => {
    const parts = path.split('/');
    return !ignoredPaths.find((ignoredPath) => parts.includes(ignoredPath));
  });
}