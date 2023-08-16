import chalk from 'chalk';
import lodash from 'lodash';

import { createEnum } from './util';

type SectionStatus = keyof typeof SECTION_STATUSES;

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

const SAVE_CURSOR = '\u001b7';
const RESTORE_CURSOR = '\u001b8';
const MOVE_CURSOR = '\u001b';
const CLEAR_LINE = '\u001b[2K';

/** Moves the cursor up a number of lines in the terminal */
function moveCursorUp(lines: number) {
  return MOVE_CURSOR + '[' + lines + 'A';
}

/** Rewrites a line in the terminal */
function rewriteLine(stream: NodeJS.WriteStream, line: number, text: string) {
  stream.write(SAVE_CURSOR);
  stream.write(moveCursorUp(line));
  stream.write(CLEAR_LINE);
  stream.write(text);
  stream.write(RESTORE_CURSOR);
}

/** Returns a section with its current icon */
function outputSection(section: Section) {
  return `${SECTION_STATUS_ICONS[section.status]} ${chalk.grey(section.name)}\n`;
}

/** Returns a progress bar */
function outputProgressBar({ succeeded, failed, total, message }: ProgressBar, width = 40) {
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

  constructor(stream: NodeJS.WriteStream) {
    this.stream = stream;
    this.interactive = stream.isTTY;
  }

  /** Manages terminal output for an async task */
  static async manage<Result>(
    stream: NodeJS.WriteStream,
    task: (progress: ProgressManager) => Promise<Result>,
  ): Promise<Result> {

    const progress = new ProgressManager(process.stdout);
    try {
      return await task(progress);
    } finally {
      progress.end();
    }
  }

  /** Redraws a section */
  redrawSection(section: Section) {
    rewriteLine(this.stream, 1 + (this.progress ? 1 : 0), outputSection(section));
  }

  /** Redraws the progress bar, throttled to the frame interval */
  redrawProgressBar = lodash.throttle((progress: ProgressBar) => {
    rewriteLine(this.stream, 1, outputProgressBar(progress));
  }, FRAME_INTERVAL);

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

  /** Increments the successes or failures of the progress bar by 1 */
  incrementProgress(success: boolean) {
    if (!this.interactive) return;
    if (!this.progress) throw new Error('No progress bar to update');
    this.progress[success ? 'succeeded' : 'failed']++;
    this.redrawProgressBar(this.progress);
  }

  /** Updates the progress bar message */
  progressBarMessage(message: string) {
    if (!this.interactive) return;
    if (!this.progress) throw new Error('No progress bar to update');
    this.progress.message = message;
    this.redrawProgressBar(this.progress);
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
    this.redrawProgressBar.cancel();
    this.sectionResult(true);
    this.progressBarDone();
  }
}
