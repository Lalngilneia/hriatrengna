import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * eslint-plugin-react stores a back-reference to itself inside
 * plugin.configs.flat.recommended.plugins.react, creating a circular
 * structure that JSON.stringify (used by Next.js to cache/compare configs)
 * cannot serialise.
 *
 * This helper strips the `configs` key from every plugin object that
 * FlatCompat places into the flat config.  The `configs` key is only
 * needed so a plugin can advertise its recommended presets — it plays no
 * role once the config is already resolved (which FlatCompat has just
 * done).  All rules, processors, and parsers are preserved.
 */
function stripPluginConfigs(flatConfigs) {
  return flatConfigs.map((cfg) => {
    if (!cfg.plugins) return cfg;
    const safePlugins = {};
    for (const [name, plugin] of Object.entries(cfg.plugins)) {
      const { configs: _dropped, ...rest } = plugin;
      safePlugins[name] = rest;
    }
    return { ...cfg, plugins: safePlugins };
  });
}

export default [
  // Exclude generated and dependency directories from linting.
  { ignores: [".next/**", "node_modules/**", "out/**", "public/**"] },

  // next/core-web-vitals includes:
  //   eslint-config-next (Next.js rules)
  //   eslint-plugin-react (JSX rules)
  //   eslint-plugin-react-hooks (hooks rules)
  //   eslint-plugin-next (@next/next rules)
  ...stripPluginConfigs(compat.extends("next/core-web-vitals")),
];
