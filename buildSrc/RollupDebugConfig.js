import * as SystemConfig from "./SystemConfig.js"
import pluginBabel from "@rollup/plugin-babel"
import commonjs from "@rollup/plugin-commonjs"
import path from "path"
import Promise from "bluebird"
import fs from "fs-extra"
import flow from "flow-bin"
import {spawn} from "child_process"

const {babel} = pluginBabel

function resolveLibs(baseDir = ".") {
	return {
		name: "resolve-libs",
		resolveId(source) {
			const resolved = SystemConfig.dependencyMap[source]
			return resolved && path.join(baseDir, resolved)
		}
	}
}

function rollupDebugPlugins(baseDir) {
	return [
		babel({
			plugins: [
				// Using Flow plugin and not preset to run before class-properties and avoid generating strange property code
				"@babel/plugin-transform-flow-strip-types",
				"@babel/plugin-proposal-class-properties",
				"@babel/plugin-syntax-dynamic-import"
			],
			inputSourceMap: false,
			babelHelpers: "bundled",
		}),
		resolveLibs(baseDir),
		commonjs({
			exclude: ["src/**"],
			ignore: ["util"]
		}),
	]
}

export default {
	input: ["src/app.js", "src/api/worker/WorkerImpl.js"],
	plugins: rollupDebugPlugins(path.resolve(".")).concat({
		name: "run-flow",
		buildStart() {
			spawn(flow, [], {stdio: "inherit"})
		},
	}),
	output: {format: "es", sourceMap: true, dir: "build"},
}

export async function writeNollupBundle(generatedBundle, dir = "build") {
	await fs.mkdirp(dir)
	return Promise.map(generatedBundle.output, (o) => fs.writeFile(path.join(dir, o.fileName), o.code))
}