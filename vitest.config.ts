import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./src/tests/setup.ts"],
		include: ["src/**/*.{test,spec}.{js,ts}"],
		exclude: ["node_modules", "dist"],
		// Enhanced isolation settings to prevent database conflicts
		maxConcurrency: 1, // Only one test at a time
		isolate: true, // Isolate test processes to prevent shared state
		sequence: {
			shuffle: false, // Run tests in predictable order
			concurrent: false, // Run test files sequentially
		},
		// Increased timeouts for database operations
		testTimeout: 30000, // 30 seconds per test
		hookTimeout: 60000, // 60 seconds for setup/teardown hooks
		env: {
			...config({ path: ".env.test" }).parsed,
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["node_modules", "dist", "src/tests", "**/*.d.ts", "**/*.config.{ts,js}", "**/index.ts"],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
});
