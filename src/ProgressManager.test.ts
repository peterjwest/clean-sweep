import { describe, test } from 'vitest';
import assert from 'assert';
import sinon from 'sinon';
import assertStub from 'sinon-assert-stub';
import chalk from 'chalk';

import { delay } from './util';
import ProgressManager, { moveCursorUp, rewriteLine, outputSection, outputProgressBar, SAVE_CURSOR, CLEAR_LINE, RESTORE_CURSOR } from './ProgressManager';

describe('moveCursorUp', () => {
  test('Returns a terminal string to move the cursor up by a number of lines', () => {
    assert.strictEqual(moveCursorUp(3), '\x1B[3A');
    assert.strictEqual(moveCursorUp(12), '\x1B[12A');
  });
});

describe('rewriteLine', () => {
  test('Writes terminal strings to rewrite a line', () => {
    const write = sinon.stub();
    const stream = { write } as unknown as NodeJS.WriteStream;
    rewriteLine(stream, 3, 'foo');

    assertStub.calledWith(write, [
      ['\x1B7'],
      ['\x1B[3A'],
      ['\x1B[2K'],
      ['foo'],
      ['\x1B8'],
    ]);
  });
});

describe('outputSection', () => {
  test('Outputs an in progress section', () => {
    assert.strictEqual(outputSection({
      name: 'foo',
      status: 'IN_PROGRESS',
    }), `${chalk.cyan('>')} ${chalk.grey('foo')}\n`);
  });

  test('Outputs a success section', () => {
    assert.strictEqual(outputSection({
      name: 'foo',
      status: 'SUCCESS',
    }), `${chalk.green('✓')} ${chalk.grey('foo')}\n`);
  });

  test('Outputs a failures section', () => {
    assert.strictEqual(outputSection({
      name: 'foo',
      status: 'FAILURE',
    }), `${chalk.red('×')} ${chalk.grey('foo')}\n`);
  });
});

describe('outputProgressBar', () => {
  test('Outputs an empty progress bar', () => {
    assert.strictEqual(
      outputProgressBar({ succeeded: 0, failed: 0, total: 23, message: 'Foo bar' }),
      `${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} Foo bar\n`,
    );
  });

  test('Outputs a partial progress bar with a single success and failure', () => {
    assert.strictEqual(
      outputProgressBar({ succeeded: 1, failed: 1, total: 23, message: 'Foo bar' }),
      `${chalk.green('▰')}${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')}${chalk.red('▰')} Foo bar\n`,
    );
  });

  test('Outputs a partial progress bar with successes', () => {
    assert.strictEqual(
      outputProgressBar({ succeeded: 7, failed: 0, total: 23, message: 'Foo bar' }),
      `${chalk.green('▰▰▰▰▰▰▰▰▰▰▰▰')}${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} Foo bar\n`,
    );
  });

  test('Outputs a partial progress bar with failures', () => {
    assert.strictEqual(
      outputProgressBar({ succeeded: 0, failed: 5, total: 23, message: 'Foo bar' }),
      `${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')}${chalk.red('▰▰▰▰▰▰▰▰')} Foo bar\n`,
    );
  });

  test('Outputs an almost finished progress bar with success and failures', () => {
    assert.strictEqual(
      outputProgressBar({ succeeded: 15, failed: 4, total: 20, message: 'Foo bar' }),
      `${chalk.green('▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰')}${chalk.grey('▱▱')}${chalk.red('▰▰▰▰▰▰▰▰')} Foo bar\n`,
    );
  });

  test('Outputs a finished progress bar with success and failures', () => {
    assert.strictEqual(
      outputProgressBar({ succeeded: 15, failed: 5, total: 20, message: 'Foo bar' }),
      `${chalk.green('▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰')}${chalk.red('▰▰▰▰▰▰▰▰▰▰')} Foo bar\n`,
    );
  });

  test('Outputs a progress bar with a custom length', () => {
    assert.strictEqual(
      outputProgressBar({ succeeded: 53, failed: 18, total: 72, message: 'Foo bar' }, 13),
      `${chalk.green('▰▰▰▰▰▰▰▰▰')}${chalk.grey('▱')}${chalk.red('▰▰▰')} Foo bar\n`,
    );
  });
});

describe('ProgressManager', () => {
  describe('constructor', () => {
    test('Contains the correct stream and interative state', () => {
      const stream = {
        isTTY: true,
        write: sinon.stub(),
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.stream, stream);
      assert.strictEqual(manager.interactive, true);
    });
  });

  // /** Adds an in-progress section to be displayed with an optional progress bar */
  // addSection(name: string, total?: number) {
  //   const index = this.sections.length - 1;
  //   if (index >= 0) {
  //     this.sectionResult(true);
  //     this.progressBarDone();
  //   }
  //   const section = { name, status: SECTION_STATUSES.IN_PROGRESS };
  //   this.sections.push(section);
  //   this.stream.write(outputSection(section));

  //   if (this.interactive && total !== undefined) {
  //     this.progress = { message: '', succeeded: 0, failed: 0, total };
  //     this.stream.write(outputProgressBar(this.progress));
  //   }

  //   return this.sections.length - 1;
  // }

  describe('addSection', () => {
    test('Adds a section with no progress bar', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section name'), 0);

      assert.strictEqual(manager.progress, undefined);
      assert.deepStrictEqual(manager.sections, [{
        name: 'Section name',
        status: 'IN_PROGRESS',
      }]);
      assertStub.calledWith(write, [
        [`${chalk.cyan('>')} ${chalk.grey('Section name')}\n`],
      ]);
    });

    test('Adds a section with a progress bar', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section name', 23), 0);

      assert.deepStrictEqual(manager.progress, {
        failed: 0,
        message: '',
        succeeded: 0,
        total: 23,
      });
      assert.deepStrictEqual(manager.sections, [{
        name: 'Section name',
        status: 'IN_PROGRESS',
      }]);
      assertStub.calledWith(write, [
        [`${chalk.cyan('>')} ${chalk.grey('Section name')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
      ]);
    });

    test('Adds a second section', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one'), 0);
      assert.strictEqual(manager.addSection('Section two', 72), 1);

      assert.deepStrictEqual(manager.progress, {
        failed: 0,
        message: '',
        succeeded: 0,
        total: 72,
      });
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'SUCCESS',
        },
        {
          name: 'Section two',
          status: 'IN_PROGRESS',
        },
      ]);
      assertStub.calledWith(write, [
        // Draw section one
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
        // Change section one to success
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.green('✓')} ${chalk.grey('Section one')}\n`],
        [RESTORE_CURSOR],
        // Draw section two
        [`${chalk.cyan('>')} ${chalk.grey('Section two')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
      ]);
    });

    test('Adds a second section after a progress bar', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one', 13), 0);
      assert.strictEqual(manager.addSection('Section two', 72), 1);

      assert.deepStrictEqual(manager.progress, {
        failed: 0,
        message: '',
        succeeded: 0,
        total: 72,
      });
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'SUCCESS',
        },
        {
          name: 'Section two',
          status: 'IN_PROGRESS',
        },
      ]);

      assertStub.calledWith(write, [
        // Draw section one
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
        // Change section one to success
        [SAVE_CURSOR],
        [moveCursorUp(2)],
        [CLEAR_LINE],
        [`${chalk.green('✓')} ${chalk.grey('Section one')}\n`],
        [RESTORE_CURSOR],
        // Delete progress bar
        [moveCursorUp(1)],
        [CLEAR_LINE],
        // Draw section two
        [`${chalk.cyan('>')} ${chalk.grey('Section two')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
      ]);
    });

    test('Only outputs sections if terminal is not a TTY', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: false,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one', 13), 0);
      assert.strictEqual(manager.addSection('Section two', 72), 1);

      assert.deepStrictEqual(manager.progress, undefined);
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'SUCCESS',
        },
        {
          name: 'Section two',
          status: 'IN_PROGRESS',
        },
      ]);

      assertStub.calledWith(write, [
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
        [`${chalk.cyan('>')} ${chalk.grey('Section two')}\n`],
      ]);
    });
  });

  describe('incrementProgress', () => {
    test('Increments successes when called with true', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one', 13), 0);
      manager.incrementProgress(true);

      assert.deepStrictEqual(manager.progress, {
        failed: 0,
        message: '',
        succeeded: 1,
        total: 13,
      });
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'IN_PROGRESS',
        },
      ]);

      assertStub.calledWith(write, [
        // Draw section one
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
        // Redraw progress bar
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.green('▰▰▰')}${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
        [RESTORE_CURSOR],
      ]);
    });

    test('Increments failures when called with false', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one', 13), 0);
      manager.incrementProgress(false);

      assert.deepStrictEqual(manager.progress, {
        failed: 1,
        message: '',
        succeeded: 0,
        total: 13,
      });
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'IN_PROGRESS',
        },
      ]);

      assertStub.calledWith(write, [
        // Draw section one
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
        // Redraw progress bar
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')}${chalk.red('▰▰▰')} \n`],
        [RESTORE_CURSOR],
      ]);
    });

    test('Does nothing when terminal is not a TTY', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: false,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one', 13), 0);
      manager.incrementProgress(false);

      assert.deepStrictEqual(manager.progress, undefined);
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'IN_PROGRESS',
        },
      ]);

      assertStub.calledWith(write, [
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
      ]);
    });

    test('Throws an error if there is no progress bar to increment', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one'), 0);
      assert.throws(() => manager.incrementProgress(true), new Error('No progress bar to update'));
    });
  });

  describe('progressBarMessage', () => {
    test('Updates the progress bar message', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one', 13), 0);
      manager.progressBarMessage('foo.txt');

      assert.deepStrictEqual(manager.progress, {
        failed: 0,
        message: 'foo.txt',
        succeeded: 0,
        total: 13,
      });
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'IN_PROGRESS',
        },
      ]);

      assertStub.calledWith(write, [
        // Draw section one
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
        // Redraw progress bar
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} foo.txt\n`],
        [RESTORE_CURSOR],
      ]);
    });

    test('Does nothing when terminal is not a TTY', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: false,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one', 13), 0);
      manager.progressBarMessage('foo.txt');

      assert.deepStrictEqual(manager.progress, undefined);
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'IN_PROGRESS',
        },
      ]);

      assertStub.calledWith(write, [
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
      ]);
    });

    test('Throws an error if there is no progress bar to increment', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one'), 0);
      assert.throws(() => manager.progressBarMessage('foo.txt'), new Error('No progress bar to update'));
    });
  });

  describe('sectionFailed', () => {
    test('Marks a section as failed', () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      const manager = new ProgressManager(stream);

      assert.strictEqual(manager.addSection('Section one', 13), 0);
      manager.sectionFailed();

      assert.deepStrictEqual(manager.progress, {
        failed: 0,
        message: '',
        succeeded: 0,
        total: 13,
      });
      assert.deepStrictEqual(manager.sections, [
        {
          name: 'Section one',
          status: 'FAILURE',
        },
      ]);

      assertStub.calledWith(write, [
        // Draw section one
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
        // Redraw progress bar
        [SAVE_CURSOR],
        [moveCursorUp(2)],
        [CLEAR_LINE],
        [`${chalk.red('×')} ${chalk.grey('Section one')}\n`],
        [RESTORE_CURSOR],
      ]);
    });
  });

  describe('manage', () => {
    test('Manages terminal output for a task, resolving with the result', async () => {
      const write = sinon.stub();
      const stream = {
        isTTY: true,
        write,
      } as unknown as NodeJS.WriteStream;

      let getManager: ProgressManager | undefined;

      const result = await ProgressManager.manage(stream, async (manager) => {
        getManager = manager;
        manager.addSection('Section one');

        manager.addSection('Section two', 32);
        manager.incrementProgress(true); // A
        manager.incrementProgress(true);
        manager.incrementProgress(false);
        manager.progressBarMessage('foo.txt');
        manager.progressBarMessage('bar.zip'); // B
        await delay(52);
        manager.incrementProgress(true); // C

        manager.addSection('Section three');
        manager.sectionFailed();

        manager.addSection('Section four');

        return 'Result';
      });

      assert(getManager);

      assert.strictEqual(result, 'Result');

      assert.deepStrictEqual(getManager.progress, undefined);
      assert.deepStrictEqual(getManager.sections, [
        {
          name: 'Section one',
          status: 'SUCCESS',
        },
        {
          name: 'Section two',
          status: 'SUCCESS',
        },
        {
          name: 'Section three',
          status: 'FAILURE',
        },
        {
          name: 'Section four',
          status: 'SUCCESS',
        },
      ]);

      assertStub.calledWith(write, [
        // Draw section one
        [`${chalk.cyan('>')} ${chalk.grey('Section one')}\n`],
        // Change section one to success
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.green('✓')} ${chalk.grey('Section one')}\n`],
        [RESTORE_CURSOR],
        // Draw section two
        [`${chalk.cyan('>')} ${chalk.grey('Section two')}\n`],
        [`${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
        // Redraw progress bar
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.green('▰')}${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')} \n`],
        [RESTORE_CURSOR],
        // Redraw progress bar again (queued after delay)
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.green('▰▰')}${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')}${chalk.red('▰')} bar.zip\n`],
        [RESTORE_CURSOR],
        // Redraw progress bar again (latest since delay, lodash.throttle is weird)
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.green('▰▰▰')}${chalk.grey('▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱')}${chalk.red('▰')} bar.zip\n`],
        [RESTORE_CURSOR],
        // Change section two to success
        [SAVE_CURSOR],
        [moveCursorUp(2)],
        [CLEAR_LINE],
        [`${chalk.green('✓')} ${chalk.grey('Section two')}\n`],
        [RESTORE_CURSOR],
        // Delete progress bar
        [moveCursorUp(1)],
        [CLEAR_LINE],
        // Draw section three
        [`${chalk.cyan('>')} ${chalk.grey('Section three')}\n`],
        // Change section three to failure
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.red('×')} ${chalk.grey('Section three')}\n`],
        [RESTORE_CURSOR],
        // Draw section four
        [`${chalk.cyan('>')} ${chalk.grey('Section four')}\n`],
        // Change section four to success
        [SAVE_CURSOR],
        [moveCursorUp(1)],
        [CLEAR_LINE],
        [`${chalk.green('✓')} ${chalk.grey('Section four')}\n`],
        [RESTORE_CURSOR],
      ]);
    });
  });
});
