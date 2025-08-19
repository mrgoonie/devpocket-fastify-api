---
description: Run test flows and fix issues
---

Execute code linting and run all tests (similar to GitHub Actions process) to test all the flows of this project and fix any issues that arise follow the workflow below:

## Context
 $ARGUMENTS

## Notes
- The test might take a long time to finish, set your command timeout to at least 15 minutes

## Workflow
You must follow this workflow strictly:
1. Start with the `project-orchestrator` agent to review the issues and provide a fix plan (Markdown file) with TODO tasks in `./plans` directory, proceed delegate this plan to implement with `backend-system-architect` agent to handle.
2. `backend-system-architect` agent receives the plan and start to implement, when the implementation is finished:
  * Delegate to `test-automator` agent with the plan Markdown file to write tests, and test again to make sure everything work properly.
  * If there are any other issues, use `expert-debugger` agent to debug and fix them.
  * If everything is done without issues, go to step 3, report to `project-orchestrator` agent to review the implementation
3. `project-orchestrator` agent reviews the implementation, run the tests again to make sure everything work properly:
  * If everything is good to go, use `api-docs-specialist` agent to update the API documentation if needed, it will report to `project-orchestrator` agent to update the original plan (in `./plans`) and close the task, then go to step 4. 
  * If there are any other issues, update the original plan (in `./plans`) and delegate to `backend-system-architect` agent to fix them (go back and continue from step 2).
4. Finally use `project-orchestrator` agent to commit and push all the code, then summarize everything and report to the user.
