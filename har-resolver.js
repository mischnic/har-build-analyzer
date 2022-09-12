const fs = require("fs");
const path = require("path");
const assert = require("assert");

const {
	PROJECT,
	PARCEL_ROOT,
	PARCEL_HAR,
	PARCEL_CACHE,
	WEBPACK_ROOT,
	WEBPACK_HAR,
	WEBPACK_INFO,
	parcelQuery,
} = require("./config.js");

const { loadGraphs } = parcelQuery;

function* iterateBundles(entries) {
	for (let d of entries) {
		let { url } = d.request;
		let { mimeType } = d.response.content;
		if (mimeType !== "application/javascript") continue;
		if (!url.startsWith("http://localhost:3000")) continue;
		if (url.includes("language-pack")) continue;

		const filename = path.relative("http://localhost:3000", url);
		yield filename;
	}
}

function parcelGetAssets(entries) {
	let { bundleGraph, requestTracker, bundleInfo } = loadGraphs(PARCEL_CACHE);
	let info = [...bundleInfo];

	let result = new Map();
	for (let filename of iterateBundles(entries)) {
		let id = info.find(([, v]) =>
			v.filePath.endsWith(path.basename(filename))
		)[0];
		assert(id != null);
		let bundle = bundleGraph._graph.getNodeByContentKey(id).value;
		assert(bundle);
		let assets = [];
		bundleGraph.traverseAssets(bundle, (a) => {
			if (a.filePath.includes("/packages/runtimes/js/")) return;

			assets.push(a.filePath);
		});
		result.set(filename, assets);
	}
	return result;
}

function webpackGetAssets(entries) {
	// new (class PrintChunksPlugin {
	//   apply(compiler) {
	//     compiler.plugin("compilation", (compilation) => {
	//       compilation.plugin("after-optimize-chunk-assets", (chunks) => {
	//         require("fs").writeFileSync(
	//           "build-bundles.json",
	//           JSON.stringify(
	//             chunks.map((chunk) => ({
	//               id: chunk.id,
	//               name: chunk.name,
	//               files: chunk.files,
	//               modules: Array.from(chunk._modules)
	//                 .map((mod) => {
	//                   return (mod.modules ?? [mod]).map((m) => ({
	//                     id: mod.id,
	//                     request: m.request,
	//                     userRequest: m.userRequest,
	//                   }));
	//                 })
	//                 .flat(),
	//             })),
	//             null,
	//             2
	//           )
	//         );
	//       });
	//     });
	//   }
	// })(),

	let bundles = new Map();
	for (let e of JSON.parse(fs.readFileSync(WEBPACK_INFO, "utf8"))) {
		assert(e.files.length === 1);
		bundles.set(
			e.files[0],
			e.modules
				.map((m) => {
					// if (m.request !== m.userRequest) {
					// 	console.log(m.request, m.userRequest);
					// }
					if (!m.userRequest) return;
					return path.relative(PROJECT, m.userRequest);
				})
				.filter(Boolean)
		);
	}

	let result = new Map();
	for (let filename of iterateBundles(entries)) {
		let b = bundles.get(filename.replace("-brotli", ""));
		assert(b);
		result.set(filename, b);
	}
	return result;
}

function flat(result) {
	return [...result.values()].flat();
}

function mapToObject(result) {
	return Object.fromEntries([...result]);
}

// ----------------------------

let parcel = parcelGetAssets(
	JSON.parse(fs.readFileSync(PARCEL_HAR, "utf8")).log.entries
);

fs.writeFileSync(
	PARCEL_HAR + ".resolved",
	JSON.stringify(mapToObject(parcel), null, 2)
);

// ----------------------------

let webpack = webpackGetAssets(
	JSON.parse(fs.readFileSync(WEBPACK_HAR, "utf8")).log.entries
);

fs.writeFileSync(
	WEBPACK_HAR + ".resolved",
	JSON.stringify(mapToObject(webpack), null, 2)
);
