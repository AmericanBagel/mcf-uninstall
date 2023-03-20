import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import process from 'process';
import { program, Option } from 'commander';

/**
 * Determine if a file path is a directory or file and call the corresponding callback if provided.
 *
 * @param {string} filepath - The file path to be evaluated.
 * @param {function} [onDirectory] - Callback function to be called if the file path is a directory.
 * @param {function} [onFile] - Callback function to be called if the file path is a file.
 *
 * @returns {"directory" | "file"} - 'directory' if the file path is a directory, 'file' if the file path is a file.
 */
function getFileType(filepath, dirCallback, fileCallback) {
	try {
		const stat = fs.statSync(filepath);

		if (stat.isDirectory()) {
			if (typeof dirCallback === 'function') {
				dirCallback();
			}
			return 'directory';
		} else if (stat.isFile()) {
			if (typeof fileCallback === 'function') {
				fileCallback();
			}
			return 'file';
		}
	} catch (error) {
		console.error(`Error checking type of "${filepath}": ${error}`);
		return null;
	}
}

function isRegExpString(str) {
	const regex = new RegExp('^/.+/[gmisxuUAJD]*$');
	return regex.test(str);
}

function filterArray(arr, _filters) {
	const filters = {
		positive: {
			string: [],
			regexp: [],
		},
		negative: {
			string: [],
			regexp: [],
		},
	};

	_filters.forEach((filter) => {
		if (filter[0] === '!' && isRegExpString(filter.substring(1))) {
			const regExpArgs = filter.substring(2).split('/');
			regExpArgs[1].replace('g', '');
			filters.negative.regexp.push(
				new RegExp(regExpArgs[0], regExpArgs[1])
			);
			return;
		}
		if (filter[0] === '!') {
			filters.negative.string.push(filter.substring(1));
			return;
		}
		if (isRegExpString(filter)) {
			const regExpArgs = filter.substring(1).split('/');
			regExpArgs[1].replace('g', '');
			filters.positive.regexp.push(
				new RegExp(regExpArgs[0], regExpArgs[1])
			);
			return;
		}
		filters.positive.string.push(filter);
	});

	let filtered = arr.filter((obj) => {
		let isMatched = false;
		if (filters.positive.string.length || filters.positive.regexp.length) {
			// Check positive string filters
			if (filters.positive.string.length) {
				for (let i = 0; i < filters.positive.string.length; i++) {
					if (obj.id.includes(filters.positive.string[i])) {
						isMatched = true;
						break;
					}
				}
			}

			if (filters.positive.regexp.length) {
				// Check positive regexp filters
				if (!isMatched) {
					for (let i = 0; i < filters.positive.regexp.length; i++) {
						if (
							new RegExp(filters.positive.regexp[i]).test(obj.id)
						) {
							isMatched = true;
							break;
						}
					}
				}
			}

			// Check negative string filters
			if (isMatched) {
				for (let i = 0; i < filters.negative.string.length; i++) {
					if (obj.id.includes(filters.negative.string[i])) {
						isMatched = false;
						break;
					}
				}
			}

			// Check negative regexp filters
			if (isMatched) {
				for (let i = 0; i < filters.negative.regexp.length; i++) {
					if (filters.negative.regexp[i].test(obj.id)) {
						isMatched = false;
						break;
					}
				}
			}
		} else if (
			filters.negative.string.length ||
			filters.negative.regexp.length
		) {
			isMatched = true;
			for (let i = 0; i < filters.negative.string.length; i++) {
				if (obj.id.includes(filters.negative.string[i])) {
					isMatched = false;
					break;
				}
			}

			for (let i = 0; i < filters.negative.regexp.length; i++) {
				if (filters.negative.regexp[i].test(obj.id)) {
					isMatched = false;
					break;
				}
			}
		} else {
			return true;
		}

		return isMatched;
	});

	return filtered;
}

/**
 * Search for regex matches in the lines of files in a directory
 *
 * @param {Object} opts
 * @param {string} opts.dir - Path to the directory to search
 * @param {RegExp} opts.regex - Regex pattern to search for
 * @param {number} opts.verbose - Level of verbosity for logs
 * @param {(string|RegExp|Array<string>|Array<RegExp>|Boolean)} value - The value to filter by, or whether to return results at all.
 * @returns {Array} results - Array of objects containing information about matches found
 */
function searchFiles(opts) {
	const { dir, regex, verbose, type, value } = opts;

	let results = [];
	function search(_currentPath, regex) {
		try {
			const currentPath = _currentPath;
			const files = fs.readdirSync(currentPath, {
				withFileTypes: true,
			});
			files.forEach((file) => {
				const filePath = path.join(currentPath, file.name);
				if (
					file.isDirectory() ||
					(file.isSymbolicLink() &&
						fs.statSync(filePath).isDirectory())
				) {
					if (verbose >= 2) {
						console.log(
							chalk.yellow.bold(
								`Entering directory: ${chalk.reset.yellow(
									filePath
								)}`
							)
						);
					}
					search(filePath, regex);
				} else if (
					file.isFile() ||
					(file.isSymbolicLink() && fs.statSync(filePath).isFile())
				) {
					if (verbose >= 4) {
						console.log(
							chalk.cyan.bold(
								`Reading file: ${chalk.reset.blue(filePath)}`
							)
						);
					}
					const content = fs.readFileSync(filePath, 'utf-8');
					content.split('\n').forEach((line) => {
						if (verbose >= 3) {
							console.log(
								chalk.cyan.bold(
									`Searching line: ${chalk.reset.cyan(line)}`
								)
							);
						}
						let match = line.match(regex);
						if (match) {
							if (verbose >= 1) {
								console.log(
									chalk.green.bold(
										`${type} found: ${chalk.reset.green(
											match[0]
										)}`
									)
								);
							}
							results.push({
								id: match[0],
								file: filePath,
								dir: path.dirname(filePath),
							});
						}
					});
				}
			});
		} catch (error) {
			console.error(chalk.red(`Error: ${error.message}`));
			process.exit(1);
		}
	}

	let _value = value;
	if (!Array.isArray(value)) _value = [value];
	if (_value != 'true' || _value == true) {
		search(dir, regex);
		if ((_value == 'false') | (_value == false)) {
			return results;
		} else {
			const filtered = filterArray(results, _value);
			return filtered;
		}
	} else {
		return [];
	}
}

function searchAll(opts) {
	const { dir, verbose, scoreboard, team, bossbar, storage, tag, killTag } =
		opts;

	const obj = {};
	if (scoreboard !== true) {
		obj.scoreboard = searchFiles({
			dir,
			regex: /(?<=scoreboard objectives add )([a-zA-Z0-9\-_.]*)/gi,
			verbose,
			type: 'Scoreboard',
			value: scoreboard,
		});
	}
	if (team !== true) {
		obj.team = searchFiles({
			dir,
			regex: /(?<=team add )([a-zA-Z0-9\-_.]*)/gi,
			verbose,
			type: 'Team',
			value: team,
		});
	}

	if (bossbar !== true) {
		obj.bossbar = searchFiles({
			dir,
			regex: /(?<=bossbar add )([a-zA-Z0-9\-_.]*)/gi,
			verbose,
			type: 'Bossbar',
			value: bossbar,
		});
	}

	if (storage !== true) {
		obj.storage = searchFiles({
			dir,
			regex: /((?<=data merge storage )|(?<=data modify storage ))([a-zA-Z0-9_.:-]+) ([a-zA-Z0-9_.:-]+)/gi,
			verbose,
			type: 'Storage',
			value: storage,
		});
	}

	if (tag !== true) {
		obj.tag = searchFiles({
			dir,
			regex: /(?<=tag @[psaer]*.add )([a-zA-Z0-9\-_.]*)/gi,
			verbose,
			type: 'Tag',
			value: tag,
		});
	}

	return obj;
}

program
	.name('mcf-uninstall')
	.description(
		'A CLI tool to automatically create uninstall functions for your datapack by recursively scanning for scoreboard objectives, teams, bossbars, and storage, and adding uninstall functions which remove them.'
	)
	.summary('create uninstall functions')
	.version('1.0.0')
	.usage('[options] <path...>')
	.addHelpText('after', '\n\n' + 'Examples:\n' + '   npx mcf-uninstall')
	.showHelpAfterError('(add --help for additional information)')
	.addOption(
		new Option(
			'-a, --adjacent',
			'Writes uninstall functions next to the functions that added scoreboard objectives instead of one mcfunction.'
		)
			.conflicts('output')
			.default(false)
	)
	.addOption(
		new Option(
			'-o, --output <path>',
			'Directory or file path for complete uninstall function.'
		).default(path.normalize('./uninstall.mcfunction'))
	)
	.addOption(
		new Option(
			'-f, --function-tag',
			'Create function tag for all created uninstall functions. If one of the provided paths is a datapack directory, an unload function tag will be created for each namespace. If one of the provided paths is a datapack namespace or function folder, an unload function tag will be created.'
		).implies({ adjacent: true })
	)
	.addOption(new Option('-v, --verbose [number]', 'Enable debug logging'))
	.addOption(
		new Option(
			'-s, --scoreboard [options...]',
			'Disable adding scoreboards to uninstall'
		).default(false)
	)
	.addOption(
		new Option(
			'-t, --team [options...]',
			'Disable adding teams to uninstall'
		).default(false)
	)
	.addOption(
		new Option(
			'-b, --bossbar',
			'Disable adding bossbars to uninstall'
		).default(false)
	)
	.addOption(
		new Option(
			'-n, --storage [options...]',
			'Disable adding storage to uninstall'
		).default(false)
	)
	.addOption(
		new Option(
			'-tg --tag [options...]',
			`Disable adding tags to uninstall by specifying just the flag or "false" or specify array tag prefix strings or regex to filter only for specific tags. Useful if your datapack touches tags that other datapacks use. If a string starts with "!", any tags starting with "!" will be excluded instead of included. Includes a regex pattern to exclude tags starting with "global" by default. To exclude a prefix, use the regex ${chalk.inverse(
				`/^(?!${chalk.bold('yourphrasehere')}).*/`
			)}.`
		).default(false)
	)
	.addOption(
		new Option(
			'-k, --kill-tag',
			'Enable killing entities with tags instead of just removing the tags. Excludes players in the generated selectors automatically.'
		).default(false)
	)
	.addOption(
		new Option(
			'-i --ignore',
			'Regular expression of filepaths to ignore. Common examples include ".git" (git hidden folder), "private" (private folders), and "/__" (folders starting with __).'
		)
	)
	.argument(
		'<path...>',
		'filepaths of directories or files with mcfunction files',
		undefined,
		'./'
	)
	.action((paths) => {
		var {
			adjacent,
			output,
			functionTag,
			verbose,
			scoreboard,
			team,
			bossbar,
			storage,
			tag,
			killTag,
		} = program.opts();

		if (
			scoreboard === true &&
			team === true &&
			bossbar === true &&
			storage === true &&
			tag === true
		) {
			console.error(
				chalk.yellow.bold(
					'Please enable at least one option: scoreboard (-s, --scoreboard), team (-t, --team), bossbar (-b, --bossbar), storage (-s, --storage), or tag (-s, --storage)!'
				)
			);
			process.exit();
		}

		var args = program.args;

		function removeDuplicates(array, key) {
			return array.filter(
				(obj, index, self) =>
					index === self.findIndex((t) => t[key] === obj[key])
			);
		}
		console.log('opts: ', program.opts());
		console.log('args: ', program.args);
		const uninstall = searchAll({
			dir: args[0],
			verbose,
			scoreboard: scoreboard,
			team: team,
			bossbar: bossbar,
			storage: storage,
			tag: tag,
		});

		function findNamespace(_current, dirname, verbose) {
			console.log(_current);
			console.log(arguments);
			let current = path.dirname(_current);
			console.log(current);
			if (verbose < 0 || verbose > 4) {
				throw new Error(
					`Verbose value should be between 0 and 4, got ${verbose}.`
				);
			}

			try {
				console.log(_current);
				console.log(current);
				// Read the contents of the current directory
				const currentContents = fs.readdirSync(current);

				// Check if the target directory is the current directory
				if (path.dirname(current) === dirname) {
					if (verbose >= 2) {
						console.log(
							chalk.green(
								'Found target directory in current directory.'
							)
						);
					}
					return {
						name: path.dirname(current),
						path: path.resolve(dirname, current),
					};
				}

				// Check if the target directory is in the contents
				if (currentContents.includes(dirname)) {
					if (verbose >= 2) {
						console.log(
							chalk.green('Found target directory in contents.')
						);
					}
					return {
						name: dirname,
						path: path.resolve(dirname, current),
					};
				}

				// Loop through the above directories to search the target directory in parent directories
				function searchParentDirectories(current) {
					const directoriesArray = path
						.normalize(current)
						.split(path.sep);
					let parent;
					let match = null;
					let increment = 0;
					while (parent !== dirname) {
						increment++;
						parent = directoriesArray[increment];
						if (parent === dirname) {
							if (verbose >= 2) {
								console.log(
									chalk.green(
										'Found target directory in parent directories.'
									)
								);
							}
							match = {
								name: parent,
								path: path.resolve(current, parent),
							};
						}
					}
					return match;
				}
				const parentDirectoriesResult =
					searchParentDirectories(current);
				if (parentDirectoriesResult) return parentDirectoriesResult;
			} catch (error) {
				console.error(
					chalk.red.bold(
						`Error reading directory "${current}": ${error}`
					)
				);
				return null;
			}

			if (verbose >= 1) {
				console.log(chalk.yellow('Target directory not found.'));
			}
			return null;
		}

		Object.entries(uninstall).forEach((e) => {
			removeDuplicates(e, 'id');
		});

		if (!adjacent) {
			let text =
				'# Uninstall function generated by mcf-uninstall script\n# https://github.com/americanbagel/mcf-uninstall\n\n';

			if (uninstall?.scoreboard.length) {
				text += '#> Scoreboards\n';
				uninstall.scoreboard.forEach((e) => {
					text += `scoreboard objectives remove ${e.id}\n`;
				});
				text += '\n\n'
			}

			if (uninstall?.team.length) {
				text += '#> Teams\n';
				uninstall.team.forEach((e) => {
					text += `team remove ${e.id}\n`;
				});
				text += '\n\n'
			}

			if (uninstall?.bossbar.length) {
				text += '#> Bossbars\n';
				uninstall.bossbar.forEach((e) => {
					text += `bossbar remove ${e.id}\n`;
				});
				text += '\n\n'
			}

			if (uninstall?.storage.length) {
				text += '#> Storage\n';
				uninstall.storage.forEach((e) => {
					text += `data remove storage ${e.id}\n`;
				});
				text += '\n\n'
			}

			if (uninstall?.tag.length) {
				text += '#> Tags\n';
				uninstall.tag.forEach((e) => {
					if (killTag) {
						text += `kill @e[tag=${e.id}]\n`;
					} else {
						text += `tag @e remove ${e.id}\n`
					}
				});
				text += '\n\n'
			}

			paths.forEach((filepath) => {
				// If it's a filename
				/* if (path.dirname(filepath) !== '.') {
					if (filepath.endsWith('.mcfunction')) {
						const writePath = path.join('./', 
					}
				} */

				const _output = output || './uninstall.mcfunction';
				if (!output.endsWith('.mcfunction')) {
					_output = output + ".mcfunction";
				}
				console.log(output)
				console.log(_output)
				fs.writeFileSync(_output, text, 'utf-8');
			});

			// fs.writeFileSync('');
		} else if (adjacent) {
			let text =
				'# Uninstall function generated by mcf-uninstall script\n# https://github.com/americanbagel/mcf-uninstall\n# Generated with adjacent option, so this function will run functions adjacent to functions which add scoreboards, bossbars, or teams\n\n';

			uninstall.scoreboard.forEach((e) => {
				/*
				fs.stat(e.dir, (err, stats) => {
					if (err) {
		                if (err.code === "ENOENT") {
		                    console.error(chalk.red.bold(
		                        `ERROR: ${e.dir} was supposed to be an existing directory, but it doesn't exist!`
		                    ));
		                } else {
		                    console.error(chalk.red.bold(`Error: ${err.message}`));
		                }
		                process.exit()
					} else if (!stats.isDirectory()) {
						console.warn(chalk.red.bold(
							`ERROR: ${e.dir} was supposed to be a directory, but it isn't anymore!`
						));
					}

		            if (stats.isDirectory()) {

					}
				});
		        */

				const uninstallDir = path.join(e.dir, `__uninstall__/`);
				fs.mkdirSync(uninstallDir);

				let text = '';

				function filterObjForMatch(obj, key, value) {
					for (const key in obj) {
						obj[key] = obj[key].filter(
							(element) => element[key] === value
						);
					}
					return obj;
				}

				const uninstallHere = filterObjForMatch(obj, 'dir', e.dir);
				console.log(uninstallHere);

				fs.writeFileSync(path.join(uninstallDir, `${e.id}.mcfunction`));
			});
		}
	});

program.parse();
