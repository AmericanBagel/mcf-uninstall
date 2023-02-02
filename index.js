import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import process from 'process';
import { program, Option } from 'commander';

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
	 * @param {string} currentPath - Path to the current directory being searched
	 */
	function search(currentPath) {
		try {
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
		).conflicts('output')
	)
	.addOption(
		new Option(
			'-o, --output <path>',
			'File path for complete uninstall function.'
		).conflicts(path.normalize('./uninstall.mcfunction'))
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

		function findNamespace(dir) {
			const parts = dir.split(path.sep);
			let namespaceIndex = parts.indexOf('data');
			let namespace, relativePath;

			if (namespaceIndex !== -1) {
				namespace = parts[namespaceIndex + 1];
				relativePath = parts.slice(namespaceIndex + 2).join(path.sep);
			} else {
				let current = parts.join(path.sep);
				while (namespaceIndex === -1 && current !== '/') {
					const contents = fs.readdirSync(current);
					if (contents.includes('data')) {
						namespaceIndex = contents.indexOf('data');
						namespace =
							parts[
								parts.length -
									(contents.length - namespaceIndex)
							];
						relativePath = parts
							.slice(
								parts.length -
									(contents.length - namespaceIndex + 1)
							)
							.join(path.sep);
						break;
					} else {
						parts.pop();
						current = parts.join(path.sep);
					}
				}
			}

			return { namespace, relativePath };
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
