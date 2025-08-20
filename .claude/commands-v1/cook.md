---
description: Implement a feature
---

Start implementing this task follow your Core Responsibilities, Subagents Team and Development Rules: 
 $ARGUMENTS

## Workflow

First use the `planner-researcher` subagent to create a implementation plan with TODO tasks in `./plans` directory.

Follow the plan given by `planner-researcher` agent and start to implement, update the progress in the plan file as you go.

When the implementation is finished, delegate to `code-reviewer` agent to review code, follow the recommendations in the report to implement.

After the code is reviewed and fixed, delegate to `tester` agent to run tests and analyze the summary report. Based on the summary report, start to implement the fix if any. Repeat this process until all issues are addressed.

After the code is tested and fixed, delegate to `docs-manager` agent to update docs in `./docs` directory if any.

Finally analyze all the reports and produce a summary of what has been processed.