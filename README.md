# Node WeasyPrint

_A NodeJS wrapper for [WeasyPrint](https://doc.courtbouillon.org/weasyprint/stable/index.html)_

This module is basically a complete complete rewrite of [Trim/weasyprint-wrapper](https://github.com/Trim/weasyprint-wrapper), and the fork chain there. This version has Typescript support, correct options parsing, and other improvements.

## Getting started

Since this is only a wrapper, you do still need the WeasyPrint binary. You’re better off following [their installation instructions](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation), but it may be as simple as installing it with `pip3`:

```
pip3 install weasyprint
```

With the binary installed, install this package from `npm`:

```
npm i node-weasyprint
```

## Usage

Example:

```ts
import weasyprint from "node-weasyprint"

// URL, specifying the format & default command to spawn weasyprint
const stream = await weasyprint("https://google.com/", {
	command: "~/programs/weasyprint"
})

// HTML
const buffer = await weasyprint("<h1>Test</h1><p>Hello world</p>", {
	buffer: true
})

// Save in a file
try {
	await weasyprint("<h1>Test</h1><p>Hello world</p>", { output: "test.pdf" })
} catch (err) {
	console.error(err)
}
```

> WeasyPrint [does not provide support](https://doc.courtbouillon.org/weasyprint/stable/common_use_cases.html#adjust-document-dimensions) for adjusting page size or document margins via flags. This is best accomplished with the CSS @page at-rule. Consider the following example:
>
> ```
> @page {
> 	size: Letter; /* Change from the default size of A4 */
> 	margin: 3cm; /* Set margin on each page */
> }
> ```

## License

MIT
