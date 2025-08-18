---
description: Implement a feature
---

Start implementing this task: 
 $ARGUMENTS

## Workflow

You must follow this workflow strictly:

1. start with the `project-orchestrator` agent to review the task.
2. the `project-orchestrator` agent should confirm with the user which approach it's going to implement.
3. once the user confirmed, `project-orchestrator` agent should create a plan (Markdown file) with TODO tasks in `./plans` directory, proceed delegate this plan to `backend-system-architect` agent to start implementing.
4. when the `backend-system-architect` finish implementing, it will delegate to `test-automator` agent to write tests, then `test-automator` agent should test again to make sure everything work properly:
  a. if there are any issues: 
    - use `expert-debugger` agent to debug and provide solutions & a detailed plan to fix
    - then `expert-debugger` agent should delegate to `backend-system-architect` agent to fix them
    - after finish fixing, `backend-system-architect` agent will report back to `test-automator` agent to test again & verify the fix.
  b. if everything is good to go, `test-automator` agent should report back to `project-orchestrator` agent.
5. `project-orchestrator` agent review the tasks and update the original plan (in `./plans`) and report back to the user:
  a. if the user is satisfied, `project-orchestrator` agent should delegate to `api-docs-specialist` agent to update the API documentation, and report back to `project-orchestrator` agent to close the tasks.
  b. finally, `project-orchestrator` agent should use to commit and push all the code.
6. if the user already deployed the app and there are any issues, use `devops-incident-responder` agent to investigate and debug.
