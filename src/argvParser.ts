/** Command line options */
export interface Options {
  [name: string]: string | boolean;
}

interface Results {
  options: Options;
  args: string[];
}

/** Splits a string by the first instance of a delimiter */
export function splitOnce(value: string, delimiter: string | RegExp): [string, string] | [string] {
  const match = value.match(delimiter);
  if (!match || match.index === undefined) {
    return [value];
  }
  return [value.slice(0, match.index), value.slice(match.index + 1)];
}

/** Parses command line arguments and options from process.argv */
export default function argvParser(argv: string[]): Results {
  const results: Results = { options: {}, args: [] };
  argv.slice(2).forEach((argument) => {
    if (argument.match(/^-/)) {
      const option = argument.replace(/^-+/, '');
      const [name, value] = splitOnce(option, '=');
      results.options[name] = value || true;
    }
    else {
      results.args.push(argument);
    }
  });

  return results;
}
