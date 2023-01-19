const fs = require(`fs/promises`)

async function run() {
	const lib = process.argv[2] || `build`

	await fs.mkdir(lib, { recursive: true })

	return Promise.all([
		fs
			.readFile(`package.json`)
			.then((data) => JSON.parse(data.toString()))
			.then((json) => {
				delete json.private
				delete json.scripts
				delete json.devDependencies

				if (json.main) {
					json.main = json.main.replace(`${lib}/`, ``)
				}

				if (json.types) {
					json.types = json.types.replace(`${lib}/`, ``)
				}

				return fs.writeFile(`${lib}/package.json`, JSON.stringify(json, undefined, `\t`))
			}),
		fs
			.readFile(`package-lock.json`)
			.then((data) => JSON.parse(data.toString()))
			.then((lock) => {
				delete lock.packages[""].devDependencies

				for (const key of Object.keys(lock.packages)) {
					if (lock.packages[key].dev) {
						delete lock.packages[key]
					}
				}

				for (const key of Object.keys(lock.dependencies)) {
					if (lock.dependencies[key].dev) {
						delete lock.dependencies[key]
					}
				}

				return fs.writeFile(
					`${lib}/package-lock.json`,
					JSON.stringify(lock, undefined, `\t`)
				)
			}),
		fs
			.readdir(".")
			.then((files) =>
				Promise.all(
					files
						.filter((f) => f.endsWith(".md"))
						.map((file) => fs.copyFile(file, `${lib}/${file}`))
				)
			)
	])
}

module.exports = run()
