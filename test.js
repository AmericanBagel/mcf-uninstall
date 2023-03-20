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
			const regExpArgs = filter.substring(2).split("/");
			regExpArgs[1].replace("g", "")
			filters.negative.regexp.push(new RegExp(regExpArgs[0], regExpArgs[1]));
			return;
		}
		if (filter[0] === '!') {
			filters.negative.string.push(filter.substring(1));
			return;
		}
		if (isRegExpString(filter)) {
			const regExpArgs = filter.substring(1).split("/");
			regExpArgs[1].replace("g", "")
			filters.positive.regexp.push(new RegExp(regExpArgs[0], regExpArgs[1]));
			return;
		}
		filters.positive.string.push(filter);
	});

	console.log(filters);

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
						if (new RegExp(filters.positive.regexp[i]).test(obj.id)) {
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
		} else if (filters.negative.string.length || filters.negative.regexp.length) {
			isMatched = true;
			for (let i = 0; i < filters.negative.string.length; i++) {
				if (obj.id.includes(filters.negative.string[i])) {
					isMatched = false;
					break;
				}
			}

			for (let i = 0; i < filters.negative.regexp.length; i++) {
				console.log("filter: ", filters.negative.regexp[0])
				console.log("obj.id: ", obj.id)
				console.log("isMatched: ", isMatched)
				console.log("match?: ", filters.negative.regexp[i].test(obj.id), "\n\n")
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

const arr = [
	{
		id: 'todd',
		file: 'test/data/customnamespace/functions/test.mcfunction',
		dir: 'test/data/customnamespace/functions',
	},
	{
		id: 'thisis.a.tag',
		file: 'test/data/customnamespace/functions/test.mcfunction',
		dir: 'test/data/customnamespace/functions',
	},
	{
		id: 'thisisnt.a.tag',
		file: 'test/data/customnamespace/functions/test.mcfunction',
		dir: 'test/data/customnamespace/functions',
	},
	{
		id: 'tagmoment.tag',
		file: 'test/data/customnamespace/functions/test.mcfunction',
		dir: 'test/data/customnamespace/functions',
	},
	{
		id: 'global',
		file: 'test/data/customnamespace/functions/test.mcfunction',
		dir: 'test/data/customnamespace/functions',
	},
	{
		id: 'global.ignore',
		file: 'test/data/customnamespace/functions/test.mcfunction',
		dir: 'test/data/customnamespace/functions',
	},
	{
		id: 'global.fancy',
		file: 'test/data/customnamespace/functions/test.mcfunction',
		dir: 'test/data/customnamespace/functions',
	},
	{
		id: 'toddglobal',
	}
];