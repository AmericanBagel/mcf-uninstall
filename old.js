// @ts-check
import { readdirSync, existsSync, lstatSync, readFileSync, writeFileSync } from 'fs';
import { join, basename, dirname, relative, normalize,  } from 'path';
import { program, Option } from 'commander';
import chalk from 'chalk';

const __filename = decodeURIComponent(new URL('', import.meta.url).pathname);
const __dirname = decodeURIComponent(new URL('.', import.meta.url).pathname);

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function searchFiles(dir, regex, verbose) {
  let results = [];

  function search(currentPath) {
    try {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        const filePath = path.join(currentPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          if (verbose) console.log(chalk.yellow(`Entering directory: ${filePath}`));
          search(filePath);
        } else if (stat.isFile()) {
          if (verbose) console.log(chalk.cyan(`Checking file: ${filePath}`));
          const content = fs.readFileSync(filePath, 'utf-8');
          content.split('\n').forEach(line => {
            let match = line.match(regex);
            if (match) {
              if (verbose) console.log(chalk.green(`Match found: ${match[0]}`));
              results.push(match[0]);
            }
          });
        }
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  }

  search(dir);
  return results;
}

const error = (input) => program.error(chalk.bold.red(input));
const scriptName = __filename.replace(/(^(([A-Z]{1}:)*[/\\]*.+[/\\]+)+)|(\..*$)/gi, "");

program
    .name('mcf-uninstall')
    .description('A CLI tool to automatically create uninstall functions for your datapack by recursively scanning for scoreboard objectives, teams, bossbars, and storage, and adding uninstall functions which remove them.')
    .usage("[options] <path...>")
    .summary("create uninstall functions")
    .addHelpText(
        'after',
        '\n\n' +
            'Examples:\n' +
            '   npx mcf-uninstall'
        )
    .showHelpAfterError('(add --help for additional information)')
    .addOption(new Option('1.0.0'))
    .addOption(new Option("-a, --adjacent", "Writes uninstall functions next to the functions that added scoreboard objectives instead of one mcfunction.").conflicts("output"))
    .addOption(new Option("-o, --output <path>", "File path for complete uninstall function.").conflicts("adjacent").default("./uninstall.mcfunction"))
    .addOption(new Option("-f, --function-tag", "Create function tag for all created uninstall functions. If one of the provided paths is a datapack directory, an unload function tag will be created for each namespace. If one of the provided paths is a datapack namespace or function folder, an unload function tag will be created.").implies({ adjacent: true }))
    .addOption(new Option("-v, --verbose", "Enable debug logging"))
    .argument("<path...>", "filepaths of directories or files with mcfunction files")
    .action((paths => {
        var { adjacent, output, functionTag, verbose } = program.opts()
        
        /**
         * @type {String[]}
         * @var
         */
        var args = program.args;
        
        args.forEach((arg) => {
            if (!existsSync(normalize(arg))) {
                error(`Invalid path "${arg}".\nPlease use a path to an existing file or directory.`);
            }
        })
        /* paths.forEach(filepath => {
            if (isDirectory(filepath)) {
                scanDir(filepath, output)
            } else {
                scanFile(filepath)
            }
        }) */
}))

program.parse();