# Agent workflow

The LangGraph StateGraph executes Data Quality → Privacy Guardian → Federated Coordinator → Model Evaluation → Explainability → Bias and Fairness → Clinical Research Assistant → Audit. Quality and budget gates route to END on failure, and every executed transition records status, summary, duration, and next action. Each agent uses executable Python logic and calculated research artifacts; no external LLM or paid API is required.

The coordinator creates a real training round. Evaluation marks results requiring human review if accuracy is below 0.80 or demographic accuracy gap exceeds 0.10. Fairness separately explains the measured gap; no medical decisions occur. Exact linear contributions are used rather than claiming SHAP. Completed cases remain pending until an authorized clinician or administrator records a research artifact decision and comments.
