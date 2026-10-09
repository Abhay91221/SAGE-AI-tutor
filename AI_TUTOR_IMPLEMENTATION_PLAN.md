# SAGE AI Tutor (Smart Adaptive Guidance & Education) - Implementation Plan

## 1. Executive Summary & Architecture Overview

**SAGE AI Tutor** (Smart Adaptive Guidance & Education) is an agentic, personalized academic tutoring platform built on top of the existing Lovable TanStack Start (Vite + React 19 + Nitro) web application.

The core goal is to elevate the existing frontend UI/UX into an **Agentic AI Academic Tutor** that:

- Maintains learner profile & dynamic mastery model (Beginner, Intermediate, Advanced).
- Ingests uploaded study materials (PDFs, notes) using a RAG pipeline with source attribution.
- Executes an **Agentic Tool-Calling Pipeline** (Agent Controller orchestrating tools for profile retrieval, RAG search, quiz generation, answer evaluation, misconception detection, progress updating, and study planning).
- Evaluates student responses semantically, detects underlying misconceptions (explaining _why_ an answer is wrong with counter-examples), and dynamically adapts teaching strategy.
- Generates adaptive quizzes, tracks weak topics, provides progress analytics, and builds custom study roadmaps.

---

## 2. Existing System Analysis

| Category                      | Technology / Pattern                                                               | Status                                |
| :---------------------------- | :--------------------------------------------------------------------------------- | :------------------------------------ |
| **Frontend Framework**        | React 19, `@tanstack/react-router`, Vite, Tailwind CSS v4, Radix UI, Lucide Icons  | Preserved baseline                    |
| **Backend & SSR**             | TanStack Start Server Functions (`createServerFn`), Nitro Engine (`src/server.ts`) | Server-side execution enforced        |
| **Styling & Design Baseline** | Custom CSS (`src/styles.css`), OKLCH theme variables, responsive layout            | Preserved 100%                        |
| **3D Visualizations**         | `@react-three/fiber`, `@react-three/drei` (`AtomScene.tsx`)                        | Procedural client R3F route preserved |
| **Database & Auth**           | Supabase JS Client (`@supabase/supabase-js`) in `src/integrations/supabase`        | Extended with SAGE schema             |
| **AI Integration**            | `src/lib/tutor.functions.ts` via server functions                                  | Refactored into Agentic Architecture  |

---

## 3. Database & Data Models (Supabase & Local State Engine)

The database schema will support:

1. `StudentProfile`: Name, grade/semester, target subjects, learning level (Beginner/Intermediate/Advanced), learning preferences.
2. `TopicMastery`: Subject, topic name, level, score (0-100), attempts count, mastery status.
3. `StudyMaterial`: Document ID, filename, file URL, total pages, upload timestamp, user ID.
4. `DocumentChunk`: Chunk ID, document ID, chunk index, text content, metadata (page number, topic), vector/embedding keywords.
5. `Quiz`: Quiz ID, topic, difficulty level, questions array (MCQ, Short Answer, T/F).
6. `QuizAttempt`: Attempt ID, quiz ID, student ID, score, answers, evaluated feedback, weak concepts identified.
7. `Misconception`: Misconception ID, topic, concept, student answer, root cause explanation, counter-example, resolved status.
8. `LearningProgress`: Summary of overall accuracy, total study sessions, completed topics, current active topic.
9. `StudyPlan`: Subject, generated roadmap nodes (topic, status, prerequisites, estimated duration), current node index.

---

## 4. Agent Architecture & Tool Suite

The **Agent Controller** operates as a modular server function orchestrator equipped with clean tool interfaces:

```
                  ┌──────────────────────────────┐
                  │    Student Query / Input     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │     Tutor Agent Controller   │
                  └──────────────┬───────────────┘
                                 │
   ┌─────────────────────────────┼─────────────────────────────┐
   ▼                             ▼                             ▼
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ Learner Profiler   │ │  Knowledge / RAG   │ │ Assessment Agent   │
│ - get_profile()    │ │ - search_material()│ │ - generate_quiz()  │
│ - update_progress()│ │ - retrieve_chunks()│ │ - evaluate_answer()│
└────────────────────┘ └────────────────────┘ └────────────────────┘
   │                             │                             │
   └─────────────────────────────┼─────────────────────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Misconception Detector &     │
                  │ Dynamic Strategy Selector    │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Structured Adaptive Response │
                  └──────────────┬───────────────┘
```

### Agent Tools

- `get_student_profile()`: Returns student background, target level, and current topic mastery.
- `search_study_material(query, document_id?)`: Performs vector/keyword similarity search on uploaded PDF notes.
- `generate_quiz(topic, level, num_questions)`: Generates adaptive structured MCQs and conceptual questions.
- `evaluate_answer(question, student_answer, correct_answer)`: Uses LLM for semantic evaluation and scoring.
- `detect_misconception(topic, student_answer)`: Analyzes wrong answers for structural conceptual flaws.
- `update_progress(topic, score, misconception?)`: Updates mastery level and logs weak topics.
- `recommend_topic()`: Determines next optimal topic based on weak areas and prerequisites.
- `create_study_plan(subject, goal)`: Generates a sequential learning roadmap with dependency tracking.

---

## 5. RAG Pipeline Implementation Architecture

1. **Document Ingestion**: Client uploads PDF or text note file via UI.
2. **Text Extraction & Cleaning**: Extracted page by page, removing headers/footers.
3. **Chunking**: Chunked into 400-600 character blocks with 50-character overlap, maintaining page metadata.
4. **Embedding / Vector Search**: High-performance semantic embedding & TF-IDF similarity indexing for relevant chunk retrieval.
5. **Context Augmentation**: Formats top-k chunks into structured context blocks passed to the LLM tutor prompt.
6. **Citation Engine**: RAG responses explicitly cite `[Source: File.pdf, Page X]`.

---

## 6. Implementation Roadmap (16 Phases)

- **PHASE 1**: Project analysis & architecture baseline validation _(Completed)_
- **PHASE 2**: AI Tutor Chat & Core Agent Architecture (Server function enhancements, context retention, structured prompt engineering)
- **PHASE 3**: Student Profile & Learner Model Management (Profile drawer/modal integration into existing sidebar/header)
- **PHASE 4**: Dynamic Adaptive Learning Engine (Level assessment, auto-tuning explanations for Beginner/Intermediate/Advanced)
- **PHASE 5**: PDF / Study Material Processing & RAG Pipeline (Document upload modal, text parser, chunk indexer, context retriever)
- **PHASE 6**: Adaptive Quiz Generator & Semantic Evaluator (Interactive Quiz UI within existing conversation panel or tab view)
- **PHASE 7**: Misconception Detection System (Deep error diagnosis, counter-example generator, targeted hint mechanics)
- **PHASE 8**: Progress Tracking & Analytics Dashboard (Mastery breakdown, accuracy metrics using Recharts in existing UI style)
- **PHASE 9**: Automated Weak Topic Detection System (Threshold-based detection, diagnostic tagging)
- **PHASE 10**: Personalized Recommendation Engine (Smart topic suggestions, adaptive flashcards/revision prompts)
- **PHASE 11**: Personalized Study Planner & Learning Roadmap (Interactive flow chart / task list within workspace)
- **PHASE 12**: Agentic Tool Calling & Orchestration (Centralized agent router uniting all modular tools)
- **PHASE 13**: End-to-End Integration Testing & Validation
- **PHASE 14**: UI/UX Regression Testing & Responsive Design Verification
- **PHASE 15**: Security, Secret Hygiene & Performance Audit
- **PHASE 16**: Final Cleanup, Code Optimization & Documentation Update

---

## 7. UI/UX Preservation Guarantee

- **Navigation & Layout**: `.app-shell`, `.sidebar`, `.topbar`, `.main-area`, and `.content-wrap` preserved intact.
- **Visual Baseline**: Palette, typography, spacing, badge chips, and cards maintain existing OKLCH aesthetics.
- **New Feature Integration**: Navigation additions (Study Materials, Quizzes, Progress, Study Plan) fit seamlessly into existing sidebar links under `"YOUR SPACE"` and topbar controls.
- **Interactive 3D Element**: R3F `AtomScene` stays loaded in the header feature panel.

---

## 8. Verification Strategy & Standards

- All server functions run on the server (`createServerFn`) to protect keys and prompts.
- All backend functions validated with unit tests or automated execution scripts.
- Frontend routes verified for console error cleanliness, smooth animations, and zero broken CSS layouts.
