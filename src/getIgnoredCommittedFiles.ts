import { promisify } from 'util';
import childProcess from 'child_process';

const exec = promisify(childProcess.exec);

export default async function getIgnoredCommittedFiles(directory: string): Promise<string[]> {
  const options = { cwd: directory, maxBuffer: 10 * 1024 * 1024 };
  const data = (await exec('git ls-files --cached --ignored --exclude-standard', options)).stdout;
  return data.trim().split('\n');
}