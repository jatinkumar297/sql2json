import { readFileSync, writeFileSync } from "fs"

const data = {}

const patientIDs = JSON.parse(readFileSync("pateintIDs.new.json", "utf8"))
const statements = readFileSync("data.sql", "utf8")
	.split("\n\nINSERT INTO")
	.filter((stmt) => stmt.trim().startsWith("`"))

function parseRow(row) {
	const result = []
	let current = ""
	let inString = false
	let escapeNext = false

	const cleanRow = row.replace(/^\(|\),?$/g, "").trim()

	for (let i = 0; i < cleanRow.length; i++) {
		const char = cleanRow[i]

		if (escapeNext) {
			current += char
			escapeNext = false
			continue
		}

		if (char === "\\") {
			escapeNext = true
			current += char
			continue
		}

		if (char === "'") {
			if (inString) {
				const nextChar = cleanRow[i + 1]
				if (nextChar === "," || nextChar === undefined || nextChar === " ") {
					inString = false
					current += char
					result.push(current.trim().slice(1, -1))
					current = ""
					if (nextChar === ",") i++
					continue
				}
			} else {
				inString = true
			}
		}

		if (!inString && char === ",") {
			if (current.trim() === "NULL") {
				result.push(null)
			} else if (current.trim() === "") {
				result.push("")
			} else {
				const num = Number(current.trim())
				result.push(isNaN(num) ? current.trim() : num)
			}
			current = ""
			continue
		}

		current += char
	}

	if (current.trim() === "NULL") {
		result.push(null)
	} else if (current.trim() !== "") {
		const num = Number(current.trim())
		result.push(isNaN(num) ? current.trim() : num)
	}

	return result
}

for (const stmt of statements) {
	const [query, values] = stmt.split("VALUES")

	const tableName = query.slice(query.indexOf("`") + 1, query.indexOf("` (`"))
	if (!data[tableName]) data[tableName] = []

	const keys = query
		.slice(query.indexOf("(") + 1, -2)
		.split(",")
		.map((i) => i.trim().replaceAll("`", ""))

	const rowValues = values.split("\n").map(parseRow)

	for (const row of rowValues) {
		if (tableName.includes("patient") && patientIDs.includes(row[0])) continue
		const json = keys.reduce(
			(r, key, idx) => ({
				...r,
				[key]: isNaN(row[idx]) ? row[idx] : +row[idx],
			}),
			{}
		)

		data[tableName].push(json)
	}
}

for (const dataField in data) writeFileSync(`${dataField}.json`, JSON.stringify(data[dataField]))
