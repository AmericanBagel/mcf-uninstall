import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import process from 'process';

/**
 * Searches for a directory name `dirname` from the directory path `dir` recursively.
 * First it looks in each directory down until either a match is found or depth exceeds `depthLimit` argument.
 * If it exceeds depth and didn't find a match, it checks if a parent directory's name matches `dirname`,
 * going up until either a match is found or parent directories go past `heightLimit` argument.
 *
 * @param {string} dir - The directory path to search for the directory `dirname` from.
 * @param {string} dirname - The directory name to search for.
 * @param {number} [depthLimit=Infinity] - The maximum directory search depth.
 * @param {number} [heightLimit=Infinity] - The maximum directory search height.
 *
 * @returns {object} An object containing the matched directory name and the relative path to the matched directory from `dir`.
 */
function searchForDirectory(
	dir,
	dirname,
	depthLimit = Infinity,
	heightLimit = Infinity
) {
	let parts;
	try {
		parts = dir.split(path.sep);
	} catch (error) {
		console.error(
			chalk.bold.red(
				`An unknown error occurred while splitting the directory path "${dir}" by the path separator "${path.sep}". Error: ${error}`
			)
		);
		return {};
	}

	let namespaceIndex = parts.indexOf(dirname);
	let namespace, relativePath;

	if (namespaceIndex !== -1) {
		namespace = parts[namespaceIndex];
		relativePath = parts.slice(namespaceIndex + 1).join(path.sep);
	} else {
		let current = parts.join(path.sep);
		let depth = 0;
		let height = 0;

		while (
			namespaceIndex === -1 &&
			depth < depthLimit &&
			height < heightLimit
		) {
			try {
				const contents = fs.readdirSync(current);
				if (contents.includes(dirname)) {
					namespaceIndex = contents.indexOf(dirname);
					namespace =
						parts[
							parts.length - (contents.length - namespaceIndex)
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
					height += 1;
				}
			} catch (error) {
				console.error(
					chalk.bold.red(
						`An unknown error occurred while searching for "${dirname}" in "${current}". Error: ${error}`
					)
				);
				return {};
			}
		}

		while (namespaceIndex === -1 && height < heightLimit) {
			try {
				const parent = path.resolve(current, '..');
				if (parent === current) {
					break;
				}
				const parentContents = fs.readdirSync(parent);
				if (parentContents.includes(dirname)) {
					namespace =
						parts[
							parts.length -
								(parentContents.length - namespaceIndex)
						];
					relativePath = parts
						.slice(
							parts.length -
								(parentContents.length - namespaceIndex + 1)
						)
						.join(path.sep);
				}
			} catch (error) {
				console.error(
					chalk.bold.red(
						`An unknown error occurred while searching for "${dirname}" in "${parent}". Error: ${error}`
					)
				);
				return {};
			}
			height++;
			parts = parent.split(path.sep);
		}
	}
	return { namespace, relativePath };
}

/**
 * Search for the directory relative to `dir` and `dirname`.
 * @param {string} dir - The directory path to start the search from.
 * @param {string} dirname - The name of the parent directory of `dir` to search for.
 * @returns {string} - The path of the child directory of `dirname` that is also the last parent directory of `dir`.
 */
function findChildWithinParent(dir, dirname) {
	let current = dir;

	// Continuously move up the directory tree until either the target directory is found or the root directory is reached.
	while (true) {
		const parent = path.resolve(current, '..');
		if (parent === current) {
			break;
		}

		// Check if the parent directory exists
		try {
			fs.statSync(parent);
		} catch (error) {
			console.error(
				`Error checking existence of directory "${parent}": ${error}`
			);
			break;
		}

		// Read the contents of the parent directory
		try {
			const parentContents = fs.readdirSync(parent);
			// Check if the target directory is in the contents
			if (parentContents.includes(dirname)) {
				// If the target directory is found, return the relative path from the target directory to the current directory
				return path.relative(path.join(parent, dirname), current);
			}
		} catch (error) {
			console.error(`Error reading directory "${parent}": ${error}`);
			break;
		}

		current = parent;
	}

	// Return an empty string if the target directory is not found
	return '';
}

/**
 * Finds the first match of `dirname` in `current` directory or its subdirectories
 * @param {string} current - The current directory path to start the search from.
 * @param {string} dirname - The name of the directory to search for.
 * @returns {object} - The path and other details of the matching directory.
 */
function findDirectoryRecursively(current, dirname) {
	try {
		// Read the contents of the current directory
		const currentContents = fs.readdirSync(current);

		// Check if the target directory is in the contents
		if (currentContents.includes(dirname)) {
			return {
				name: dirname,
				path: path.resolve(dirname, current)
			};
		}

		// Loop through the contents to search the target directory in subdirectories
		function searchSubdirectories(contents) {
			for (const content of contents) {
				// Check if the content is a directory
				if (fs.statSync(path.join(current, content)).isDirectory()) {
					// Recursively search the subdirectory
					const result = findDirectoryRecursively(
						path.join(current, content),
						dirname
					);

					if (result) {
						return result;
					}
				}
			}
		}
		/* const subdirectoriesResult = searchSubdirectories(currentContents);
		if (subdirectoriesResult) return subdirectoriesResult; */

		// Loop through the above directories to search the target directory in parent directories
		function searchParentDirectories(current) {
			const directoriesArray = path.normalize(current).split(path.sep);
			let parent;
			let match = null;
			let increment = 0;
			while (parent !== dirname) {
				increment++;
				parent = directoriesArray[increment];
				if (parent === dirname) {
					match = {
						name: parent,
						path: path.resolve(current, parent)
					}
				}
			}
			return match;
		}
		const parentDirectoriesResult = searchParentDirectories(current);
		if (parentDirectoriesResult) return parentDirectoriesResult;
	} catch (error) {
		console.error(`Error reading directory "${current}": ${error}`);
	}
	return null;
}

console.log(
	findDirectoryRecursively(
		'/home/bagel/.local/share/PrismLauncher/instances/Datapack Dev/.minecraft/resourcepacks/minecraft-but/',
		'data'
	)
);