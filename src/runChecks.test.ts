import { describe, test } from 'vitest';
import assert from 'assert';
import sinon from 'sinon';
import assertStub from 'sinon-assert-stub';

import { RULES } from './rules';
import { DEFAULT_CONFIG } from './config';
import { FileResult } from './util';
import extendConfig from './extendConfig';
import ProgressManager from './ProgressManager';
import runChecks from './runChecks';

describe('runChecks', () => {
  test('Runs the check successfully for each configured file', async () => {
    const files = ['foo.txt', 'bar.ts', 'zim.md'];
    const title = 'Example title';

    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = {
      addSection,
      incrementProgress,
      progressBarMessage,
      sectionFailed,
    } as unknown as ProgressManager;

    const config = extendConfig(DEFAULT_CONFIG);
    const check = sinon.stub();
    check.withArgs('foo.txt').resolves(new FileResult(0));
    check.withArgs('bar.ts').resolves(new FileResult(3));
    check.withArgs('zim.md').resolves(new FileResult(5));

    const results = await runChecks(title, files, progress as unknown as ProgressManager, config, check);

    assertStub.calledWith(check, [
      ['foo.txt', config],
      ['bar.ts', config],
      ['zim.md', config],
    ]);

    assert.deepStrictEqual(results, {
      'foo.txt': new FileResult(0),
      'bar.ts': new FileResult(3),
      'zim.md':new FileResult(5),
    });

    assertStub.calledWith(addSection, [['Example title', 3]]);
    assertStub.calledWith(progressBarMessage, [['foo.txt'], ['bar.ts'], ['zim.md']]);
    assertStub.calledWith(incrementProgress, [[true], [true], [true]]);
    assertStub.notCalled(sectionFailed);
  });

  test('Runs the check for each file with failures', async () => {
    const files = ['foo.txt', 'bar.ts', 'zim.md'];
    const title = 'Example title';

    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = { addSection, incrementProgress, progressBarMessage, sectionFailed } as unknown as ProgressManager;

    const config = extendConfig(DEFAULT_CONFIG);
    const check = sinon.stub();
    check.withArgs('foo.txt').resolves(new FileResult(0));
    check.withArgs('bar.ts').resolves(new FileResult(3, [{
      type: RULES.IGNORED_COMMITTED_FILE,
    }]));
    check.withArgs('zim.md').resolves(new FileResult(5, [{
      type: RULES.NO_FINAL_NEWLINE,
      line: 3,
    }]));

    const results = await runChecks(title, files, progress, config, check);

    assertStub.calledWith(check, [
      ['foo.txt', config],
      ['bar.ts', config],
      ['zim.md', config],
    ]);

    assert.deepStrictEqual(results, {
      'foo.txt': new FileResult(0),
      'bar.ts': new FileResult(3, [{
        type: RULES.IGNORED_COMMITTED_FILE,
      }]),
      'zim.md': new FileResult(5, [{
        type: RULES.NO_FINAL_NEWLINE,
        line: 3,
      }]),
    });

    assertStub.calledWith(addSection, [['Example title', 3]]);
    assertStub.calledWith(progressBarMessage, [['foo.txt'], ['bar.ts'], ['zim.md']]);
    assertStub.calledWith(incrementProgress, [[true], [false], [false]]);
    assertStub.calledWith(sectionFailed, [[], []]);
  });
});
