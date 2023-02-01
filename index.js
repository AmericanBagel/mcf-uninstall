// @ts-check
import { readdirSync, existsSync, lstatSync, readFileSync, writeFileSync } from 'fs';
import { join, basename, dirname, relative, normalize,  } from 'path';
import { program, Option } from 'commander';
import chalk from 'chalk';

const __filename = decodeURIComponent(new URL('', import.meta.url).pathname);
const __dirname = decodeURIComponent(new URL('.', import.meta.url).pathname);

/**
 * Options given as arguments on commandline
 * @typedef {{ adjacent: Boolean, output: import('fs').PathLike, functionTag: Boolean, verbose: boolean }} CommandArgs
 */

function getDirsInDir(filepath) {
	return readdirSync(filepath, { withFileTypes: true }).reduce((a, c) => {
		c.isDirectory() && a.push(c.name);
		return a;
	}, []);
}

function test(bool) {

}

function getFilesInDir(filepath) {
    return readdirSync(filepath, { withFileTypes: true }).reduce((a, c) => {
		!c.isDirectory() && a.push(c.name);
		return a;
	}, []);
}

function isDirectory(filepath) {
    return existsSync(filepath) && lstatSync(filepath).isDirectory();
}

function isFile(filepath) {
    return !isDirectory(filepath);
}

function fileOrDirectory(filepath) {
    return isDirectory(filepath) ? "directory" : "folder"
}

/**
 * Scan through file and process, looking for scoreboards, objectives, teams, and bossbars, and either write uninstall function or add to list.
 * @param {String} filepath Path of file to scan and process
 * @param {CommandArgs} options CLI args
 * @returns undefined
 */
function scanDir(filepath, options) {
	const directories = getDirsInDir(filepath);
    const files = getFilesInDir(filepath);

    directories.forEach(directory => {
        scanDir(join(filepath, directory), output, verbose);
    })

    files.forEach(file => {
        scanFile(join(filepath, file), output, verbose);
    })
}

/**
 * Scan through file and process, looking for scoreboards, objectives, teams, and bossbars, and either write uninstall function or add to list.
 * @param {String} filepath Path of file to scan and process
 * @param {CommandArgs} options CLI args
 */
function scanFile(filepath, options) {
    // Only proceed if file is mcfunction
    if (basename(filepath).match(/\.mcfunction$/) !== null) {
        const text = readFileSync(filepath, "utf-8")
        const arr = text.split("\n");

        const objectives = [];
        arr.forEach(e => {
            const match = e.match(/(?<=scoreboard objectives add )[a-zA-Z0-9_.]*(?<= .+)/);
            if (match !== null) {
                objectives.push(match[0])
            }
        })

        if (objectives.length > 0) {
            let uninstallMCF = '';
            objectives.forEach(e => {
                uninstallMCF += 'scoreboard objectives remove ' + e + '\n'
            })
            
            writeFileSync(join(dirname(filepath), "uninstall.mcfunction"), uninstallMCF)
            
            if (verbose) {
                console.log("Wrote " + relative((dirname(filepath)), "uninstall.mcfunction"))
            }
        }
    }
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