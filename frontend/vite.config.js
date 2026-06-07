import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


const NODE_MODULES_PATH = "node_modules";

const VENDOR_CHUNK_RULES = [
    {
        chunkName: "vendor-mui",
        packages: [
            "/@mui/material/",
            "/@mui/system/",
            "/@mui/utils/",
            "/@mui/base/",
            "/@mui/private-theming/",
            "/@mui/styled-engine/",
            "/@mui/icons-material/",
        ],
    },
    {
        chunkName: "vendor-core",
        packages: [
            "/react/",
            "/react-dom/",
            "/scheduler/",
            "/@emotion/react/",
            "/@emotion/styled/",
            "/@emotion/cache/",
            "/@emotion/serialize/",
            "/@emotion/use-insertion-effect-with-fallbacks/",
            "/@emotion/utils/",
            "/@emotion/weak-memoize/",
            "/stylis/",
            "/hoist-non-react-statics/",
            "/react-is/",
        ],
    },
    {
        chunkName: "vendor-fonts",
        packages: [
            "/@fontsource/roboto/",
        ],
    },
];


function getManualChunk(id) {
    if (!id.includes(NODE_MODULES_PATH)) {
        return undefined;
    }

    const normalizedId = id.replaceAll("\\", "/");
    const matchedRule = VENDOR_CHUNK_RULES.find(function matchVendorChunkRule(rule) {
        return rule.packages.some(function matchVendorPackage(packagePath) {
            return normalizedId.includes(packagePath);
        });
    });

    if (matchedRule) {
        return matchedRule.chunkName;
    }

    return "vendor-core";
}


// Vite provides the local React development server and production build.
export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                manualChunks: getManualChunk,
            },
        },
    },
    plugins: [react()],
});
