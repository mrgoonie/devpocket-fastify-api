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
		// Force truly sequential execution to prevent race conditions
		maxConcurrency: 1, // Only one test at a time
		fileParallelism: false, // Disable file parallelism completely
		isolate: false, // Disable worker isolation
		pool: 'forks', // Use fork pool for better isolation
		poolOptions: {
			forks: {
				singleFork: true, // Force single worker process
				minForks: 1,
				maxForks: 1, // Explicitly limit to 1 fork
			}
		},
		sequence: {
			shuffle: false, // Run tests in predictable order
			concurrent: false, // Run test files sequentially
			setupFiles: 'list', // Run setup files in list order
		},
		// Increased timeouts for database operations
		testTimeout: 45000, // 45 seconds per test (increased for slower CI)
		hookTimeout: 90000, // 90 seconds for setup/teardown hooks (increased)
		// Add delays between test files to ensure complete cleanup
		teardownTimeout: 30000, // 30 seconds for teardown
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
