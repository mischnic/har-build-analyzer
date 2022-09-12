Perform analysis on a the JS bundles loaded in a specific page

## Usage

1. Copy and adjust `config.js` from the template.
2. Run a Webpack build (using the Webpack plugin in the comment in `har-resolved.js`) and a Parcel build (no additional config needed, the cache is read).
3. Load the same page using both builds and save the HAR file for each at the location specified in the config.
4. Run `har-resolver.js` first to generate the `foo.har.resolved` files (which list the bundles and their contained assets respectively).
5. Use `har-analyzer.js` for analysis, existing commands:
    - `node har-analyzer.js additional`: list assets that are only bundled by Parcel
    - `node har-analyzer.js duplicates`: list assets that are bundled (and loaded!) into multple bundles
    - `node har-analyzer.js search <term>`: search for a string in the loaded bundles
    - `node har-analyzer.js overhead`: statistical analysis comparing (sum of raw asset sizes) and (individual bundle sizes)
