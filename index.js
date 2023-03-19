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

/**
 * Search for regex matches in the lines of files in a directory
 *
 * @param {Object} opts
 * @param {string} opts.dir - Path to the directory to search
 * @param {RegExp} opts.regex - Regex pattern to search for
 * @param {number} opts.verbose - Level of verbosity for logs
 * @returns {Array} results - Array of objects containing information about matches found
 */
function searchFiles(opts) {
	const { dir, regex, verbose, type } = opts;
	let results = [];

	/**
	 * Recursive function to search for regex matches in the lines of files in a directory
	 * @param {string} _currentPath - Path to the current directory being searched
	 */
	function search(_currentPath) {
		try {
			const currentPath = path.dirname(_currentPath);
			const files = fs.readdirSync(currentPath, { withFileTypes: true });
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
					search(filePath);
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

	search(dir);
	return results;
}

function searchAll(opts) {
	const { dir, verbose, scoreboard, team, bossbar } = opts;

	const obj = {};
	if (opts?.scoreboard) {
		obj.scoreboard = searchFiles({
			dir: dir,
			regex: /(?<=scoreboard objectives add )([a-zA-Z0-9_.]*)/gi,
			verbose: verbose,
			type: 'Scoreboard',
		});
	}
	if (opts?.team) {
		obj.team = searchFiles({
			dir: dir,
			regex: /(?<=team add )([a-zA-Z0-9_.]*)/gi,
			verbose: verbose,
			type: 'Team',
		});
	}

	if (opts?.bossbar) {
		obj.bossbar = searchFiles({
			dir: dir,
			regex: /(?<=bossbar add )([a-zA-Z0-9_.]*)/gi,
			verbose: verbose,
			type: 'Bossbar',
		});
	}

	console.log();
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
		).conflicts('output').default(false)
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
			'-s, --scoreboard',
			'Disable adding scoreboards to uninstall'
		).default(false)
	)
	.addOption(
		new Option('-t, --team', 'Disable adding teams to uninstall').default(
			false
		)
	)
	.addOption(
		new Option(
			'-b, --bossbar',
			'Disable adding bossbars to uninstall'
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
		} = program.opts();

		if (scoreboard && team && bossbar) {
			console.error(
				chalk.yellow.bold(
					'Please enable at least one option: scoreboard (-s, --scoreboard), team (-t, --team), or bossbar (-b, --bossbar)!'
				)
			);
			process.exit();
		}

		/**
		 * @type {String[]}
		 * @var
		 */
		var args = program.args;

		function removeDuplicates(array, key) {
			return array.filter(
				(obj, index, self) =>
					index === self.findIndex((t) => t[key] === obj[key])
			);
		}

		const uninstall = {};
		args.forEach((arg) => {
			const obj = searchAll({
				dir: arg,
				verbose: verbose,
				scoreboard: !scoreboard,
				team: !team,
				bossbar: !bossbar,
			});
			uninstall.scoreboard = [...obj.scoreboard];
			uninstall.team = [...obj.team];
			uninstall.bossbar = [...obj.bossbar];
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

			if (scoreboard) {
				text += '#> Scoreboards\n';
				uninstall.scoreboard.forEach((e) => {
					text += `scoreboard objectives remove ${e.id}`;
				});
			}

			if (team) {
				text += '#> Teams\n';
				uninstall.team.forEach((e) => {
					text += `team remove ${e.id}`;
				});
			}

			if (bossbar) {
				text += '#> Bossbars\n';
				uninstall.bossbar.forEach((e) => {
					text += `bossbar remove ${e.id}`;
				});
			}

			paths.forEach((path) => {
				console.log(path);
				console.log(findNamespace(path, 'data'));
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
