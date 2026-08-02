# Process execution

The first execution layer records facts without turning BPMN into a workflow
engine. A published process can have many independent instances. Each instance
stores the process version, start time, initiator and task states.

Users with execution permission open **Выполнения**, start an instance and select
it as the current execution. Task cards then provide **Начать шаг** and
**Завершить шаг** actions. In-progress tasks are amber and completed tasks are
green on the full BPMN canvas.

Execution files are stored under `Data/Executions` and ignored by Git. Later 1C
adapters will write the same facts automatically from ERP document creation,
approval, posting and payment events. Manual tracking remains useful for physical
or organizational steps that leave no ERP document.
