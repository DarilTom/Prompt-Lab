/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { improvePrompt, getPrompts } from "../services/promptService";

const PromptImproverContext = createContext(null);

export function PromptImproverProvider({ children }) {
  const { user } = useAuth();
  // Input fields
  const [promptText, setPromptText] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [userModel, setUserModel] = useState(null);

  // Active operation tracking
  const [improving, setImproving] = useState(false);
  const [activeModel, setActiveModel] = useState(null);
  const [error, setError] = useState("");
  const [improvedResult, setImprovedResult] = useState(null);
  const [originalDraft, setOriginalDraft] = useState("");
  const [editablePrompt, setEditablePrompt] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  // Scroll coordination
  const [shouldScroll, setShouldScroll] = useState(false);

  // Global notification banner for header
  const [notification, setNotification] = useState(null);

  // Save states
  const [userPrompts, setUserPrompts] = useState([]);
  const [saveMode, setSaveMode] = useState(null); // 'new' | 'version' | null
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedPromptInfo, setSavedPromptInfo] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("engineering");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [versionNote, setVersionNote] = useState("Improved via AI Prompt Improver");

  const clearShouldScroll = useCallback(() => {
    setShouldScroll(false);
  }, []);

  const triggerScroll = useCallback(() => {
    setShouldScroll(true);
  }, []);

  const dismissNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const refreshUserPrompts = useCallback(async () => {
    try {
      const res = await getPrompts();
      const list = Array.isArray(res) ? res : res?.results || [];
      setUserPrompts(list);
      if (list.length > 0) {
        setSelectedPromptId((prev) => prev || String(list[0].id));
      }
      return list;
    } catch (err) {
      console.warn("Could not load user prompts for version selection:", err);
      return [];
    }
  }, []);

  // Main improve action
  const handleImprove = useCallback(
    async ({
      promptText: currentPromptText,
      context: currentContext,
      tone: currentTone,
      outputFormat: currentFormat,
      model,
    }) => {
      // Prevent concurrent duplicate executions
      if (improving) return;

      const trimmedGoal = (currentPromptText ?? promptText).trim();
      if (!trimmedGoal) {
        setError("Please describe what you want the AI to accomplish.");
        return;
      }

      if (!model) {
        setError("Please select an available Ollama model.");
        return;
      }

      try {
        setImproving(true);
        setActiveModel(model);
        setError("");
        setSaveError("");
        setSavedPromptInfo(null);
        setSaveMode(null);
        setNotification(null);

        const result = await improvePrompt({
          prompt_text: trimmedGoal,
          context: (currentContext ?? context).trim(),
          tone: currentTone ?? tone,
          output_format: currentFormat ?? outputFormat,
          model,
        });

        const initialSug = {
          id: Date.now(),
          improved_prompt: result.improved_prompt || "",
          explanation: result.explanation || "",
          model: result.model || model,
          editable_text: result.improved_prompt || "",
        };

        setOriginalDraft(trimmedGoal);
        setSuggestions([initialSug]);
        setActiveSuggestionIndex(0);
        setImprovedResult(result);
        setEditablePrompt(result.improved_prompt || "");

        // Pre-fill a default title for save-as-new based on original prompt
        const words = trimmedGoal.split(/\s+/).slice(0, 5).join(" ");
        setNewTitle(
          words
            ? words.charAt(0).toUpperCase() + words.slice(1)
            : "Improved Prompt"
        );

        // Trigger scroll once rendered
        if (user?.auto_scroll_results !== false) {
          setShouldScroll(true);
        }

        // Header notification
        if (user?.notify_on_completion !== false) {
          setNotification({
            type: "success",
            message: `Prompt improved with ${result.model || model}!`,
            model: result.model || model,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error(err);
        const errMsg =
          err.message ||
          (model
            ? `Unable to improve prompt with ${model}. Please ensure Ollama is running locally.`
            : "Unable to improve prompt. Please check that Ollama is running locally.");
        setError(errMsg);
        if (user?.notify_on_completion !== false) {
          setNotification({
            type: "error",
            message: errMsg,
            model,
            timestamp: Date.now(),
          });
        }
      } finally {
        setImproving(false);
      }
    },
    [improving, promptText, context, tone, outputFormat, user]
  );

  // Improve again action (successive variation)
  const handleImproveAgain = useCallback(
    async ({ model }) => {
      if (improving || saveLoading) return;

      const baseGoal = originalDraft || promptText.trim();
      if (!baseGoal) {
        setError("Please describe what you want the AI to accomplish.");
        return;
      }

      if (!model) {
        setError("Please select an available Ollama model.");
        return;
      }

      try {
        setImproving(true);
        setActiveModel(model);
        setError("");
        setSaveError("");
        setNotification(null);

        // Preserve user edits on the currently active suggestion before generating another
        const updatedSuggestions = suggestions.map((sug, idx) =>
          idx === activeSuggestionIndex
            ? { ...sug, editable_text: editablePrompt }
            : sug
        );

        const result = await improvePrompt({
          prompt_text: baseGoal,
          context: context.trim(),
          tone,
          output_format: outputFormat,
          model,
        });

        const nextSug = {
          id: Date.now(),
          improved_prompt: result.improved_prompt || "",
          explanation: result.explanation || "",
          model: result.model || model,
          editable_text: result.improved_prompt || "",
        };

        const finalSuggestions = [...updatedSuggestions, nextSug];
        setSuggestions(finalSuggestions);
        setActiveSuggestionIndex(finalSuggestions.length - 1);
        setImprovedResult(result);
        setEditablePrompt(nextSug.improved_prompt);
        setSavedPromptInfo(null);
        if (user?.auto_scroll_results !== false) {
          setShouldScroll(true);
        }

        if (user?.notify_on_completion !== false) {
          setNotification({
            type: "success",
            message: `New suggestion generated with ${result.model || model}!`,
            model: result.model || model,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error(err);
        const errMsg =
          err.message ||
          "Unable to generate another suggestion. Please check that Ollama is running.";
        setError(errMsg);
        if (user?.notify_on_completion !== false) {
          setNotification({
            type: "error",
            message: errMsg,
            model,
            timestamp: Date.now(),
          });
        }
      } finally {
        setImproving(false);
      }
    },
    [
      improving,
      saveLoading,
      originalDraft,
      promptText,
      context,
      tone,
      outputFormat,
      suggestions,
      activeSuggestionIndex,
      editablePrompt,
      user,
    ]
  );

  const handleSelectSuggestion = useCallback(
    (index) => {
      if (
        index === activeSuggestionIndex ||
        index < 0 ||
        index >= suggestions.length
      )
        return;

      const updated = suggestions.map((sug, idx) =>
        idx === activeSuggestionIndex
          ? { ...sug, editable_text: editablePrompt }
          : sug
      );
      setSuggestions(updated);

      const target = updated[index];
      setActiveSuggestionIndex(index);
      setEditablePrompt(target.editable_text);
      setImprovedResult(target);
    },
    [activeSuggestionIndex, suggestions, editablePrompt]
  );

  const value = {
    promptText,
    setPromptText,
    context,
    setContext,
    tone,
    setTone,
    outputFormat,
    setOutputFormat,
    userModel,
    setUserModel,

    improving,
    activeModel,
    error,
    setError,
    improvedResult,
    setImprovedResult,
    originalDraft,
    setOriginalDraft,
    editablePrompt,
    setEditablePrompt,
    suggestions,
    setSuggestions,
    activeSuggestionIndex,
    setActiveSuggestionIndex,

    shouldScroll,
    setShouldScroll,
    triggerScroll,
    clearShouldScroll,

    notification,
    dismissNotification,

    userPrompts,
    setUserPrompts,
    refreshUserPrompts,
    saveMode,
    setSaveMode,
    saveLoading,
    setSaveLoading,
    saveError,
    setSaveError,
    savedPromptInfo,
    setSavedPromptInfo,
    newTitle,
    setNewTitle,
    newCategory,
    setNewCategory,
    selectedPromptId,
    setSelectedPromptId,
    versionNote,
    setVersionNote,

    handleImprove,
    handleImproveAgain,
    handleSelectSuggestion,
  };

  return (
    <PromptImproverContext.Provider value={value}>
      {children}
    </PromptImproverContext.Provider>
  );
}

export function usePromptImprover() {
  const context = useContext(PromptImproverContext);
  if (!context) {
    throw new Error(
      "usePromptImprover must be used within a PromptImproverProvider"
    );
  }
  return context;
}
