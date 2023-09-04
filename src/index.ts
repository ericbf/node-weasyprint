import { paramCase } from "change-case"
import { spawn } from "child_process"
import debug from "debug"
import internal from "stream"

const log = debug("weasyprint:log")
const err = debug("weasyprint:error")

const quote = (val: string) =>
	process.platform !== "win32" ? `"${val.replace(/(["\\$`])/g, "\\$1")}"` : val

type Size = "images" | "fonts" | "all" | "none"

type WeasyPrintOptions = {
	/**
	 * Force the input character encoding (e.g. `encoding: "utf-8"`).
	 */
	encoding?: string //  <input_encoding>
	/**
	 * Filename or URL of a user cascading stylesheet (see Stylesheet Origins) to add to the document (e.g. `stylesheet: "print.css"`). Multiple stylesheets are allowed by passing an array.
	 */
	stylesheet?: string | string[] //  <filename_or_URL>
	/**
	 * Set the media type to use for @media. Defaults to print.
	 */
	mediaType?: string //  <type>
	/**
	 * Set the base for relative URLs in the HTML input. Defaults to the input’s own URL, or the current directory for stdin.
	 */
	baseUrl?: string //  <URL>
	/**
	 * Adds an attachment to the document. The attachment is included in the PDF output. This option can be used multiple times by passing an array.
	 */
	attachment?: string | string[] //  <file>
	/**
	 * PDF file identifier, used to check whether two different files are two different versions of the same original document.
	 */
	pdfIdentifier?: string //  <identifier>
	/**
	 * PDF variant to generate (e.g. `pdfVariant: "pdf/a-3b"`).
	 */
	pdfVariant?: string //  <variant-name>
	/**
	 * PDF version number (default is 1.7).
	 */
	pdfVersion?: string //  <version-number>
	/**
	 * Include custom HTML meta tags in PDF metadata.
	 */
	customMetadata?: boolean
	/**
	 * Follow HTML presentational hints.
	 */
	presentationalHints?: boolean
	/**
	 * Optimize the size of generated documents. Supported types are images, fonts, all and none. This option can be used multiple times by passing an array, all adds all allowed values, none removes all previously set values.
	 */
	optimizeSize?: Size | Size[] //  <type>
	/**
	 * Show warnings and information messages.
	 */
	verbose?: boolean
	/**
	 * Show debugging messages.
	 */
	debug?: boolean
	/**
	 * Hide logging messages.
	 */
	quiet?: boolean
	/**
	 * Show the version number. Other options and arguments are ignored.
	 */
	version?: boolean
	/**
	 * Show the command-line usage. Other options and arguments are ignored.
	 */
	help?: boolean
}

export type WeasyPrintFileOutputOptions = {
	/** The command to use, if `weasyprint` is not in your path, or if you want to use another command. */
	command?: string

	/** A filename to write to. */
	output: string

	/** Nothing to buffer—it’s writing to a file. */
	buffer?: undefined
} & WeasyPrintOptions

export type WeasyPrintStreamOptions = {
	/** The command to use, if `weasyprint` is not in your path, or if you want to use another command. */
	command?: string

	/** Don’t include an output, so it writes to stdout.  */
	output?: undefined

	/** Return the actual stream. */
	buffer?: undefined
} & WeasyPrintOptions

export type WeasyPrintBufferOptions = {
	/** The command to use, if `weasyprint` is not in your path, or if you want to use another command. */
	command?: string

	/** Don’t include an output, so it writes to stdout.  */
	output?: undefined

	/** Write to a buffer and return the buffer */
	buffer: true
} & WeasyPrintOptions

/**
 * Create a PDF from the passed input and get a buffer of the result.
 *
 * @param input The html string, or URL of the page, to turn into a PDF.
 * @param options The configuration for the command.
 * @returns A promise that resolves to the result of the command.
 */
function weasyprint(input: string, options: WeasyPrintBufferOptions): Promise<Buffer>

/**
 * Create a PDF from the passed input and write it to a file.
 *
 * @param input The html string, or URL of the page, to turn into a PDF.
 * @param options The configuration for the command.
 * @returns A promise that resolves when finished.
 */
function weasyprint(input: string, options: WeasyPrintFileOutputOptions): Promise<void>

/**
 * Create a PDF from the passed input and get a stream with the result.
 *
 * @param input The html string, or URL of the page, to turn into a PDF.
 * @param options The configuration for the command.
 * @returns A stream with the result.
 */
function weasyprint(
	input: string,
	options?: WeasyPrintStreamOptions
): internal.Readable & { err: internal.Readable }

function weasyprint(
	input: string,
	{
		command = "weasyprint",
		output,
		buffer,
		...options
	}: WeasyPrintFileOutputOptions | WeasyPrintBufferOptions | WeasyPrintStreamOptions = {}
) {
	let child: ReturnType<typeof spawn>

	const isUrl = /^(https?|file):\/\//.test(input)
	const args: [string, ...string[]] = [command]

	Object.entries(options).forEach(function parseOption([camelCaseArg, value]) {
		const arg = paramCase(camelCaseArg)

		if (typeof value === "boolean") {
			if (value) {
				args.push(`--${arg}`)
			}
		} else if (typeof value === "string") {
			args.push(`--${arg}`, value)
		} else if (Array.isArray(value)) {
			value.forEach((v) => parseOption([arg, v]))
		}
	})

	args.push(isUrl ? quote(input) : "-") // stdin if HTML given directly
	args.push(output ? quote(output) : "-") // stdout if no output file

	log("Spawning %s with args %o...", args[0], args)

	child = spawn(args[0], args.slice(1))

	if (!child.stdout || !child.stderr) {
		throw new Error("Failed to spawn process")
	}

	// write input to stdin if it isn't a url
	if (!isUrl) {
		child.stdin?.end(input)
	}

	if (!output && !buffer) {
		return Object.assign(child.stdout, { err: child.stderr })
	}

	const buffers: Buffer[] = []
	const errBuffers: Buffer[] = []

	if (!output) {
		child.stdout.on("data", (chunk) => {
			buffers.push(Buffer.from(chunk))
		})
	}

	child.stderr.on("data", (chunk) => {
		errBuffers.push(Buffer.from(chunk))
		err(chunk.toString("utf8").trim())
	})

	return new Promise<Buffer | void>((resolve, reject) => {
		let settled = false

		child.on("error", (error) => {
			if (!settled) {
				settled = true

				if ("code" in error && error.code === "ENOENT") {
					reject(new Error(`Command \`${command}\` not found. Is it installed?`))
				} else {
					reject(error)
				}
			}
		})

		child.on("exit", () => {
			if (!settled) {
				settled = true

				if (child.exitCode) {
					reject(new Error(Buffer.concat(errBuffers).toString("utf8")))
				} else {
					if (!output) {
						resolve(Buffer.concat(buffers))
					} else {
						resolve()
					}
				}
			}
		})
	})
}

export default weasyprint
