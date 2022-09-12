const fs = require("fs");
const path = require("path");

const {
	PROJECT,
	PARCEL_REPO,
	PARCEL_ROOT,
	WEBPACK_ROOT,
	PARCEL_HAR,
	WEBPACK_HAR,
} = require("./config.js");

let parcel = JSON.parse(fs.readFileSync(PARCEL_HAR + ".resolved"));
let webpack = JSON.parse(fs.readFileSync(WEBPACK_HAR + ".resolved"));

function flat(result) {
	return Object.values(result).flat();
}

const args = process.argv.slice(2);

if (args[0] === "additional") {
	let parcelFlat = new Set(flat(parcel));
	let webpackFlat = new Set(flat(webpack));

	let problems = [];

	for (let f of parcelFlat) {
		if (
			!webpackFlat.has(f) &&
			// Webpack prefers .mjs over .js for dependencies without explicit extension
			!webpackFlat.has(f.replace(/\.js$/, ".mjs")) &&
			// Some deps such as core-js is resolved relative to the Parcel installation
			!webpackFlat.has(f.replace(PARCEL_REPO, ""))
		) {
			problems.push([
				f,
				Object.entries(parcel).find(([k, v]) => v.includes(f))[0],
			]);
		}
	}

	problems.sort(([a], [b]) => a.localeCompare(b));

	let sum = 0;
	for (let [asset, bundle] of problems) {
		try {
			sum += fs.statSync(path.join(PROJECT, asset)).size;
		} catch (e) {
			console.log("Skip for size", asset);
		}
		console.log(asset, bundle);
	}
	console.log("Total", sum);
} else if (args[0] === "overhead") {
	let sumDiffsParcel = 0;
	let bundlesTotalParcel = 0;
	let assetsTotalParcel = 0;
	console.log("# Parcel");
	for (let [bundle, assets] of Object.entries(parcel)) {
		let bundleSize = fs.statSync(path.join(PARCEL_ROOT, bundle)).size;
		let assetsSize = 0;
		for (let a of assets) {
			try {
				assetsSize += fs.statSync(path.join(PROJECT, a)).size;
			} catch (e) {}
		}
		console.log(
			bundle,
			bundleSize,
			assetsSize,
			(bundleSize / assetsSize).toFixed(3)
		);
		sumDiffsParcel += bundleSize - assetsSize;
		bundlesTotalParcel += bundleSize;
		assetsTotalParcel += assetsSize;
	}
	console.log(
		"Diff",
		sumDiffsParcel,
		"assetsTotal",
		assetsTotalParcel,
		"/",
		(sumDiffsParcel / assetsTotalParcel).toFixed(3),
		"bundlesTotal",
		bundlesTotalParcel,
		"/",
		(sumDiffsParcel / bundlesTotalParcel).toFixed(3)
	);

	console.log("# Webpack");
	let sumDiffsWebpack = 0;
	let bundlesTotalWebpack = 0;
	let assetsTotalWebpack = 0;
	for (let [bundle, assets] of Object.entries(webpack)) {
		let bundleSize = fs.statSync(path.join(WEBPACK_ROOT, bundle)).size;
		let assetsSize = 0;
		for (let a of assets) {
			try {
				assetsSize += fs.statSync(a).size;
			} catch (e) {}
		}
		console.log(
			bundle,
			bundleSize,
			assetsSize,
			(bundleSize / assetsSize).toFixed(3)
		);
		sumDiffsWebpack += bundleSize - assetsSize;
		bundlesTotalWebpack += bundleSize;
		assetsTotalWebpack += assetsSize;
	}
	console.log(
		"Diff",
		sumDiffsWebpack,
		"assetsTotal",
		assetsTotalWebpack,
		"/",
		(sumDiffsWebpack / assetsTotalWebpack).toFixed(3),
		"bundlesTotal",
		bundlesTotalWebpack,
		"/",
		(sumDiffsWebpack / bundlesTotalWebpack).toFixed(3)
	);
} else if (args[0] === "search") {
	const term = args[1];

	console.log("Searching for:", term);
	for (let f of Object.keys(parcel)) {
		let content = fs.readFileSync(path.join(PARCEL_ROOT, f), "utf8");
		if (content.includes(term)) {
			console.log("parcel", path.join(PARCEL_ROOT, f));
		}
	}
	for (let f of Object.keys(webpack)) {
		let content = fs.readFileSync(path.join(WEBPACK_ROOT, f), "utf8");
		if (content.includes(term)) {
			console.log("webpack", path.join(WEBPACK_ROOT, f));
		}
	}
} else if (args[0] === "duplicates") {
	const sortMap = (v) =>
		new Map([...v].sort(([a], [b]) => a.localeCompare(b)));

	let bundlesByAssetParcel = new Map();
	console.log("# Parcel");
	for (let [bundle, assets] of Object.entries(parcel)) {
		for (let a of assets) {
			try {
				let v = bundlesByAssetParcel.get(a) ?? [];
				v.push(bundle);
				bundlesByAssetParcel.set(a, v);
			} catch (e) {}
		}
	}
	let duplicatesParcel = sortMap(
		new Map([...bundlesByAssetParcel].filter(([, v]) => v.length > 1))
	);
	let sumParcel = 0;
	let countParcel = 0;
	for (let [a, bundles] of duplicatesParcel) {
		try {
			sumParcel +=
				fs.statSync(path.join(PROJECT, a)).size * (bundles.length - 1);
			countParcel += bundles.length;
		} catch (e) {}
	}
	console.log(
		`There are ${duplicatesParcel.size} unique assets being packaged ${countParcel} times\n` +
			`Total additional asset size: ${sumParcel}`
	);

	console.log("# Webpack");
	let bundlesByAssetWebpack = new Map();
	for (let [bundle, assets] of Object.entries(webpack)) {
		for (let a of assets) {
			try {
				let v = bundlesByAssetWebpack.get(a) ?? [];
				v.push(bundle);
				bundlesByAssetWebpack.set(a, v);
			} catch (e) {}
		}
	}
	let duplicatesWebpack = sortMap(
		new Map([...bundlesByAssetWebpack].filter(([, v]) => v.length > 1))
	);
	let sumWebpack = 0;
	let countWebpack = 0;
	for (let [a, bundles] of duplicatesWebpack) {
		try {
			sumWebpack +=
				fs.statSync(path.join(PROJECT, a)).size * (bundles.length - 1);
			countWebpack += bundles.length;
		} catch (e) {}
	}
	console.log(
		`There are ${duplicatesWebpack.size} unique assets being packaged ${countWebpack} times\n` +
			`Total additional asset size: ${sumWebpack}`
	);

	console.log("# Diff: only duplicated in Parcel");
	for (let [a, bundles] of duplicatesParcel) {
		if (!duplicatesWebpack.has(a)) {
			console.log(a, bundles.length);
		}
	}
	console.log("# Diff: only duplicated in Webpack");
	for (let [a, bundles] of duplicatesWebpack) {
		if (!duplicatesParcel.has(a)) {
			console.log(a, bundles.length);
		}
	}
	console.log("# Diff: duplicated in both with different counts");
	for (let [a, bundles] of duplicatesWebpack) {
		if (duplicatesParcel.has(a)) {
			if (
				duplicatesParcel.get(a).length !==
				duplicatesWebpack.get(a).length
			) {
				console.log(
					a,
					duplicatesParcel.get(a).length,
					duplicatesWebpack.get(a).length
				);
			}
		}
	}
} else {
	console.log(
		"Unknown command, expected one of: additional, duplicates, overhead, search <term>"
	);
}
