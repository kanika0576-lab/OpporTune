import { useState } from "react";
import {
  EDUCATION_LEVELS,
  type EducationLevel,
  type StudentProfile,
  type TeamSize,
} from "../types";

interface ProfileFormProps {
  profile: StudentProfile;
  onChange: (profile: StudentProfile) => void;
  onSave: () => void;
  saved: boolean;
}

const EDUCATION_LABELS: Record<EducationLevel, string> = {
  high_school: "High school / secondary",
  undergraduate: "Undergraduate (bachelor's)",
  graduate: "Graduate (master's)",
  phd: "PhD / doctoral",
  other: "Other / not listed",
};

const TEAM_OPTIONS: { id: TeamSize; label: string; hint: string }[] = [
  { id: "solo", label: "Solo", hint: "I apply alone" },
  { id: "small", label: "Small team", hint: "2–4 people" },
  { id: "large", label: "Large team", hint: "5+ people" },
  { id: "any", label: "Not decided", hint: "Let me decide later" },
];

const SUGGESTED_INTERESTS = [
  "artificial intelligence",
  "web development",
  "fintech",
  "climate",
  "healthcare",
  "social impact",
  "open source",
  "data science",
  "design",
  "robotics",
];

const SUGGESTED_SKILLS = [
  "python",
  "javascript",
  "typescript",
  "react",
  "sql",
  "figma",
  "machine learning",
  "git",
  "communication",
  "leadership",
  "data analysis",
  "html",
  "css",
  "excel",
];

function TagEditor({
  id,
  label,
  hint,
  values,
  suggestions,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  values: string[];
  suggestions: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    if (values.some((v) => v.toLowerCase() === value)) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  }

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <p className="mb-2 text-xs text-navy-500" id={`${id}-hint`}>
        {hint}
      </p>
      <div className="flex gap-2">
        <input
          id={id}
          className="field"
          value={draft}
          placeholder="Type and press Add"
          aria-describedby={`${id}-hint`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            }
          }}
        />
        <button
          type="button"
          className="btn btn-secondary shrink-0"
          onClick={() => commit(draft)}
        >
          Add
        </button>
      </div>

      {values.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value}>
              <span className="chip bg-teal-50 text-teal-800">
                {value}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((v) => v !== value))}
                  className="ml-1 rounded-full px-1 text-teal-600 hover:bg-teal-100 hover:text-teal-900"
                  aria-label={`Remove ${value}`}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions
          .filter((s) => !values.some((v) => v.toLowerCase() === s))
          .slice(0, 8)
          .map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => commit(suggestion)}
              className="rounded-full border border-navy-200 px-2.5 py-1 text-[11px] font-semibold text-navy-500 transition hover:border-teal-400 hover:text-teal-700"
            >
              + {suggestion}
            </button>
          ))}
      </div>
    </div>
  );
}

export default function ProfileForm({
  profile,
  onChange,
  onSave,
  saved,
}: ProfileFormProps) {
  return (
    <form
      className="card p-6 sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="grid gap-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="profile-name">
              Your name
            </label>
            <input
              id="profile-name"
              className="field"
              value={profile.name}
              placeholder="e.g. Kanika"
              onChange={(event) =>
                onChange({ ...profile, name: event.target.value })
              }
            />
          </div>

          <div>
            <label className="label" htmlFor="profile-education">
              Education level
            </label>
            <select
              id="profile-education"
              className="field"
              value={profile.educationLevel}
              onChange={(event) =>
                onChange({
                  ...profile,
                  educationLevel: event.target.value as EducationLevel | "",
                })
              }
            >
              <option value="">Select your level…</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {EDUCATION_LABELS[level]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <TagEditor
          id="profile-interests"
          label="Interests"
          hint="Used for the relevance score only — never to decide eligibility."
          values={profile.interests}
          suggestions={SUGGESTED_INTERESTS}
          onChange={(interests) => onChange({ ...profile, interests })}
        />

        <TagEditor
          id="profile-skills"
          label="Skills"
          hint="Compared against the skills named on each opportunity's page."
          values={profile.skills}
          suggestions={SUGGESTED_SKILLS}
          onChange={(skills) => onChange({ ...profile, skills })}
        />

        <div>
          <label className="label" htmlFor="profile-location">
            Location
          </label>
          <input
            id="profile-location"
            className="field"
            value={profile.location}
            placeholder="e.g. Delhi, India"
            onChange={(event) =>
              onChange({ ...profile, location: event.target.value })
            }
          />
        </div>

        <fieldset>
          <legend className="label">Team size</legend>
          <div className="grid gap-2 sm:grid-cols-4">
            {TEAM_OPTIONS.map((option) => {
              const id = `team-${option.id}`;
              const checked = profile.teamSize === option.id;
              return (
                <label
                  key={option.id}
                  htmlFor={id}
                  className={`flex cursor-pointer flex-col rounded-xl border p-3 transition ${
                    checked
                      ? "border-teal-500 bg-teal-50"
                      : "border-navy-200 bg-white hover:border-navy-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      id={id}
                      type="radio"
                      name="team-size"
                      value={option.id}
                      checked={checked}
                      onChange={() =>
                        onChange({ ...profile, teamSize: option.id })
                      }
                      className="h-4 w-4 accent-teal-500"
                    />
                    <span className="text-sm font-bold text-navy-900">
                      {option.label}
                    </span>
                  </span>
                  <span className="mt-1 pl-6 text-[11px] text-navy-500">
                    {option.hint}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-navy-100 pt-5">
          <button type="submit" className="btn btn-primary">
            Save profile
          </button>
          {saved ? (
            <span
              role="status"
              className="text-sm font-semibold text-teal-700"
            >
              ✓ Saved to this browser
            </span>
          ) : (
            <span className="text-sm text-navy-500">
              Your profile is stored in this browser only.
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
