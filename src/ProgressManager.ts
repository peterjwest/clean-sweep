import chalk from 'chalk';
import lodash from 'lodash';

import { createEnum } from './util';

type SectionStatus = keyof typeof SECTION_STATUSES;

type Task<Result> = (progress: ProgressManager) => Promise<Result>

interface Section {
  name: string;
  status: SectionStatus;
}

interface ProgressBar {
  message: string;
  succeeded: number;
  failed: number;
  total: number;
}

const SECTION_STATUSES = createEnum([
  'IN_PROGRESS',
  'SUCCESS',
  'FAILURE',
]);

const SECTION_STATUS_ICONS = {
  IN_PROGRESS: chalk.cyan('>'),
  SUCCESS: chalk.green('✓'),
  FAILURE: chalk.red('×'),
} as const satisfies { [Property in SectionStatus]: string };

/** Frame delay to render progress in milliseconds */
const FRAME_INTERVAL = 1000 / 20; // 50 ms = 1000 ms / 20 fps

export const SAVE_CURSOR = '\u001b7';
export const RESTORE_CURSOR = '\u001b8';
export const MOVE_CURSOR = '\u001b';
export const CLEAR_LINE = '\u001b[2K';

/** Moves the cursor up a number of lines in the terminal */
export function moveCursorUp(lines: number) {
  return MOVE_CURSOR + '[' + lines + 'A';
}

/** Rewrites a line in the terminal */
export function rewriteLine(stream: NodeJS.WriteStream, line: number, text: string) {
  stream.write(SAVE_CURSOR);
  stream.write(moveCursorUp(line));
  stream.write(CLEAR_LINE);
  stream.write(text);
  stream.write(RESTORE_CURSOR);
}

/** Returns a section with its current icon */
export function outputSection(section: Section) {
  return `${SECTION_STATUS_ICONS[section.status]} ${chalk.grey(section.name)}\n`;
}

/** Returns a progress bar */
export function outputProgressBar({ succeeded, failed, total, message }: ProgressBar, width = 40) {
  const successWidth = Math.floor(width * (succeeded / total));
  const errorWidth = Math.floor(width * (failed / total));
  // Ensure any non-zero number of errors are visible */
  const clampedErrorWidth = failed > 0 ? Math.max(errorWidth, 1) : 0;
  return [
    chalk.green('▰'.repeat(successWidth)),
    chalk.grey('▱'.repeat(width - successWidth - errorWidth)),
    chalk.red('▰'.repeat(clampedErrorWidth)),
    ` ${message}\n`,
  ].join('');
}

/** Manages named entries (sections) and their status in a terminal stream */
export default class ProgressManager {
  interactive: boolean;
  stream: NodeJS.WriteStream;
  sections: Section[] = [];
  progress?: ProgressBar;
  redrawProgressThrottled;

  constructor(stream: NodeJS.WriteStream) {
    this.stream = stream;
    this.interactive = stream.isTTY;

    /** Redraws the progress bar, throttled to the frame interval */
    this.redrawProgressThrottled = lodash.throttle(() => {
      if (this.progress) rewriteLine(this.stream, 1, outputProgressBar(this.progress));
    }, FRAME_INTERVAL);
  }

  /** Manages terminal output for an async task */
  static async manage<Result>(stream: NodeJS.WriteStream, task: Task<Result>): Promise<Result> {
    const progress = new ProgressManager(stream);
    try {
      return await task(progress);
    } finally {
      progress.end();
    }
  }

  /** Adds an in-progress section to be displayed with an optional progress bar */
  addSection(name: string, total?: number) {
    const index = this.sections.length - 1;
    if (index >= 0) {
      this.sectionResult(true);
      this.progressBarDone();
    }
    const section = { name, status: SECTION_STATUSES.IN_PROGRESS };
    this.sections.push(section);
    this.stream.write(outputSection(section));

    if (this.interactive && total !== undefined) {
      this.progress = { message: '', succeeded: 0, failed: 0, total };
      this.stream.write(outputProgressBar(this.progress));
    }

    return this.sections.length - 1;
  }

  /** Redraws a section */
  redrawSection(section: Section) {
    rewriteLine(this.stream, 1 + (this.progress ? 1 : 0), outputSection(section));
  }

  /** Redraws the progress bar, throttled to the frame interval */
  redrawProgressBar() {
    this.redrawProgressThrottled();
  }

  /** Increments the successes or failures of the progress bar by 1 */
  incrementProgress(success: boolean) {
    if (!this.interactive) return;
    if (!this.progress) throw new Error('No progress bar to update');
    this.progress[success ? 'succeeded' : 'failed']++;
    this.redrawProgressBar();
  }

  /** Updates the progress bar message */
  progressBarMessage(message: string) {
    if (!this.interactive) return;
    if (!this.progress) throw new Error('No progress bar to update');
    this.progress.message = message;
    this.redrawProgressBar();
  }

  /** Marks the last section as succeeded or failed, if not already complete */
  sectionResult(success: boolean) {
    const section = this.sections[this.sections.length - 1];
    if (!section) return;
    if (section.status === SECTION_STATUSES.IN_PROGRESS) {
      section.status = success ? SECTION_STATUSES.SUCCESS : SECTION_STATUSES.FAILURE;
      if (this.interactive) this.redrawSection(section);
    }
  }

  /** Removes the progress bar */
  progressBarDone() {
    if (this.progress) {
      this.progress = undefined;
      this.stream.write(moveCursorUp(1));
      this.stream.write(CLEAR_LINE);
    }
  }

  /** Marks the last section as failed, if not already complete */
  sectionFailed() {
    this.sectionResult(false);
  }

  /** Ends the final section, removes the progress bar */
  end() {
    this.redrawProgressThrottled.cancel();
    this.sectionResult(true);
    this.progressBarDone();
  }
}
