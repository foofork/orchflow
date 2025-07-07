#!/bin/bash
set -eo pipefail # Exit immediately if a command exits with a non-zero status or a pipe fails

# Define ANSI color codes
NC='\033[0m'       # No Color - Resets all attributes
BOLD='\033[1m'     # Bold
RED='\033[31m'     # Red text
GREEN='\033[32m'   # Green text
YELLOW='\033[33m'  # Yellow text
BLUE='\033[34m'    # Blue text
CYAN='\033[36m'    # Cyan text

# This script helps configure global Claude Code settings for privacy and control.
# It modifies ~/.claude/settings.json, preserving other existing settings.
#
# Prerequisites: 'jq' must be installed on your system.
#
# Usage:
# 1. Save this script as 'setup_claude_privacy.sh'.
# 2. Make it executable: chmod +x setup_claude_privacy.sh
# 3. Run it: ./setup_claude_privacy.sh

CLAUDE_SETTINGS_FILE="$HOME/.claude/settings.json"

echo -e "${CYAN}${BOLD}---------------------------------------------------------${NC}"
echo -e "${CYAN}${BOLD} Claude Code Privacy & Optimization Setup${NC}"
echo -e "${CYAN}${BOLD} Modifying: $CLAUDE_SETTINGS_FILE${NC}"
echo -e "${CYAN}${BOLD}---------------------------------------------------------${NC}"
echo ""

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}${BOLD}Error: 'jq' is not installed.${NC}"
    echo "Please install 'jq' (e.g., 'brew install jq' on macOS, 'sudo apt-get install jq' on Linux) and try again."
    exit 1
fi

# Ensure the .claude directory exists
mkdir -p "$HOME/.claude"

# Create settings.json if it doesn't exist with an empty JSON object
if [ ! -f "$CLAUDE_SETTINGS_FILE" ]; then
    echo "{}" > "$CLAUDE_SETTINGS_FILE"
    echo -e "Created new settings file: ${CYAN}$CLAUDE_SETTINGS_FILE${NC}"
fi

# Function to get a setting value and format it with color
get_setting() {
    local key="$1"
    # Check if the key exists, if its value is not null, and if its value is not an empty string.
    # Otherwise, it's considered "N/A" for display.
    local value_check=$(jq -r "if has(\"$key\") and (.\"$key\" != null) and (.\"$key\" | tostring) != \"\" then .\"$key\" | tostring else \"_NA_\" end" "$CLAUDE_SETTINGS_FILE" 2>/dev/null)

    case "$value_check" in
        "_NA_")      echo -e "${BLUE}N/A${NC}" ;;
        "true")      echo -e "${GREEN}true${NC}" ;;
        "false")     echo -e "${RED}false${NC}" ;;
        *)           echo -e "${BLUE}$value_check${NC}" ;; # For numbers, strings, etc.
    esac
}

# Function to check if Maximize Privacy is largely applied
is_max_privacy_applied() {
    local disable_nonessential=$(jq -r "if has(\"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC\") then .CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE")
    local include_coauthoredby=$(jq -r "if has(\"includeCoAuthoredBy\") then .includeCoAuthoredBy | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE")
    local disable_telemetry=$(jq -r "if has(\"DISABLE_TELEMETRY\") then .DISABLE_TELEMETRY | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE")
    local disable_error_reporting=$(jq -r "if has(\"DISABLE_ERROR_REPORTING\") then .DISABLE_ERROR_REPORTING | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE")

    if [[ "$disable_nonessential" == "true" && "$include_coauthoredby" == "false" && "$disable_telemetry" == "true" && "$disable_error_reporting" == "true" ]]; then
        return 0 # True
    else
        return 1 # False
    fi
}

# Function to check if Balanced Privacy is largely applied
is_balanced_privacy_applied() {
    local disable_telemetry=$(jq -r "if has(\"DISABLE_TELEMETRY\") then .DISABLE_TELEMETRY | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE")
    local disable_error_reporting=$(jq -r "if has(\"DISABLE_ERROR_REPORTING\") then .DISABLE_ERROR_REPORTING | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE")
    local include_coauthoredby=$(jq -r "if has(\"includeCoAuthoredBy\") then .includeCoAuthoredBy | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE")
    local disable_nonessential=$(jq -r "if has(\"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC\") then .CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE") # Check this isn't true for balanced

    if [[ "$disable_telemetry" == "true" && "$disable_error_reporting" == "true" && "$include_coauthoredby" == "false" ]]; then
        # Ensure it's not also set for Maximize Privacy fully (i.e., CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is NOT true)
        if [[ "$disable_nonessential" != "true" ]]; then
            return 0 # True (for balanced)
        fi
    fi
    return 1 # False
}

# Function to check if Minimal Local Retention is largely applied (now checking for 0 or 1)
is_minimal_retention_applied() {
    local cleanup_period=$(jq -r "if has(\"cleanupPeriodDays\") then .cleanupPeriodDays | tostring else \"_MISSING_\" end" "$CLAUDE_SETTINGS_FILE")
    # Consider "0" or "1" as minimal
    if [[ "$cleanup_period" == "1" || "$cleanup_period" == "0" ]]; then
        return 0 # True
    else
        return 1 # False
    fi
}


temp_json=$(mktemp)
# Read current settings into temp_json to start
cp "$CLAUDE_SETTINGS_FILE" "$temp_json"

echo -e "${CYAN}--- Core Privacy / Data Sharing Control ---${NC}"
echo "Current Settings:"
echo -e "  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: $(get_setting CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC)"
echo -e "  DISABLE_TELEMETRY: $(get_setting DISABLE_TELEMETRY)"
echo -e "  DISABLE_ERROR_REPORTING: $(get_setting DISABLE_ERROR_REPORTING)"
echo -e "  includeCoAuthoredBy: $(get_setting includeCoAuthoredBy)"
echo ""
echo "Choose your preferred privacy level:"

# Dynamically build options based on current state
declare -a core_options_keys
declare -a core_prompts_text

# Option A: Maximize Privacy
if ! is_max_privacy_applied; then
    core_options_keys+=("A")
    core_prompts_text+=("A. Maximize Privacy ${GREEN}(Recommended)${NC}: Disables non-essential traffic (telemetry, auto-updates, /bug, error reporting) and prevents Claude from auto-adding 'Co-authored-by:'.")
else
    core_options_keys+=("A")
    core_prompts_text+=("A. Maximize Privacy ${GREEN}(Recommended)${NC} ${YELLOW}(Already Applied)${NC}: Disables non-essential traffic (telemetry, auto-updates, /bug, error reporting) and prevents Claude from auto-adding 'Co-authored-by:'.")
fi

# Option B: Balanced Privacy
if ! is_balanced_privacy_applied; then
    core_options_keys+=("B")
    core_prompts_text+=("B. Balanced Privacy: Disables only telemetry and error reporting. Prevents Claude from auto-adding 'Co-authored-by:'.")
else
    # Only mark as already applied if Maximize Privacy isn't also applied
    if ! is_max_privacy_applied; then
        core_options_keys+=("B")
        core_prompts_text+=("B. Balanced Privacy ${YELLOW}(Already Applied)${NC}: Disables only telemetry and error reporting. Prevents Claude from auto-adding 'Co-authored-by:'.")
    else
        core_options_keys+=("B") # Still offer it, but no "already applied" since A covers it
        core_prompts_text+=("B. Balanced Privacy: Disables only telemetry and error reporting. Prevents Claude from auto-adding 'Co-authored-by:'.")
    fi
fi

# Option C: Keep Current Settings
core_options_keys+=("C")
core_prompts_text+=("C. Keep Current Settings: No change to these core privacy settings.")

# Option X: Skip this section only
core_options_keys+=("X")
core_prompts_text+=("X. Skip ${BOLD}(Do Nothing to this section)${NC}: Proceed to the next configuration section.")

# Print dynamically ordered options
for prompt in "${core_prompts_text[@]}"; do
    echo -e "$prompt"
done

read -p "Enter your choice ($(IFS=/; echo "${core_options_keys[*]}")): " CORE_PRIVACY_CHOICE
CORE_PRIVACY_CHOICE=$(echo "$CORE_PRIVACY_CHOICE" | tr '[:lower:]' '[:upper:]') # Convert to uppercase

case "$CORE_PRIVACY_CHOICE" in
    A)
        echo -e "Applying Maximize Privacy..."
        jq \
            '.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = true | .includeCoAuthoredBy = false | .DISABLE_TELEMETRY = true | .DISABLE_ERROR_REPORTING = true' \
            "$temp_json" > "$temp_json.new" && mv "$temp_json.new" "$temp_json"
        ;;
    B)
        echo -e "Applying Balanced Privacy..."
        jq \
            '.DISABLE_TELEMETRY = true | .DISABLE_ERROR_REPORTING = true | .includeCoAuthoredBy = false' \
            "$temp_json" > "$temp_json.new" && mv "$temp_json.new" "$temp_json"
        ;;
    C)
        echo -e "Keeping current core privacy settings."
        # No change needed to temp_json as it already holds original settings
        ;;
    X)
        echo -e "${YELLOW}Skipping Core Privacy section.${NC}"
        # IMPORTANT: Do NOT exit here. Allow the script to proceed to the next section.
        ;;
    *)
        echo -e "${RED}${BOLD}Invalid choice for Core Privacy. Skipping this section.${NC}"
        # No change needed
        ;;
esac

echo ""
echo -e "${CYAN}--- Chat Transcript Retention (Local Storage) ---${NC}"
echo "Current Settings:"
echo -e "  cleanupPeriodDays: $(get_setting cleanupPeriodDays)"
echo ""
echo "Choose your preferred retention policy:"

declare -a retention_options_keys
declare -a retention_prompts_text

# Option A: Custom Retention
retention_options_keys+=("A")
retention_prompts_text+=("A. Custom Retention ${GREEN}(Recommended for Control)${NC}: Enter the number of days (0 for immediate deletion).")

# Option B: Default Local Retention
retention_options_keys+=("B")
retention_prompts_text+=("B. Default Local Retention: Leaves 'cleanupPeriodDays' as is (usually 30 days default by Claude Code if not explicitly set).")

# Option X: Exit (this section only)
retention_options_keys+=("X")
retention_prompts_text+=("X. Skip ${BOLD}(Do Nothing to this section)${NC}: Proceed to the final summary.")

# Print dynamically ordered options
for prompt in "${retention_prompts_text[@]}"; do
    echo -e "$prompt"
done

read -p "Enter your choice ($(IFS=/; echo "${retention_options_keys[*]}")): " RETENTION_CHOICE
RETENTION_CHOICE=$(echo "$RETENTION_CHOICE" | tr '[:lower:]' '[:upper:]') # Convert to uppercase

case "$RETENTION_CHOICE" in
    A)
        VALID_INPUT=false
        while [ "$VALID_INPUT" == false ]; do
            read -p "Enter number of days to retain (0 for immediate deletion, e.g., 7 for one week): " DAYS_TO_RETAIN
            # Check if input is a non-negative integer
            if [[ "$DAYS_TO_RETAIN" =~ ^[0-9]+$ ]]; then
                echo -e "Setting local retention to ${DAYS_TO_RETAIN} day(s)..."
                jq ".cleanupPeriodDays = $DAYS_TO_RETAIN" "$temp_json" > "$temp_json.new" && mv "$temp_json.new" "$temp_json"
                VALID_INPUT=true
            else
                echo -e "${RED}Invalid input. Please enter a non-negative integer.${NC}"
            fi
        done
        ;;
    B)
        echo -e "Keeping current local retention settings."
        # No change needed
        ;;
    X)
        echo -e "${YELLOW}Skipping Chat Transcript Retention section.${NC}"
        # IMPORTANT: Do NOT exit here. Allow the script to proceed to the final save.
        # temp_json already contains changes from the first section if any were made.
        ;;
    *)
        echo -e "${RED}${BOLD}Invalid choice for Retention. Skipping this section.${NC}"
        # No change needed
        ;;
esac

# Final update of CURRENT_SETTINGS and write to original file
# This will save any changes made in previous sections, even if the last section was skipped with 'X'
mv "$temp_json" "$CLAUDE_SETTINGS_FILE"

# --- Post-Checks and Final Summary ---
echo -e "${GREEN}${BOLD}---------------------------------------------------------${NC}"
echo -e "${GREEN}${BOLD}Claude Code settings updated successfully.${NC}"
echo -e "${GREEN}${BOLD}---------------------------------------------------------${NC}"

# Explicit verification of key applied settings
echo -e "${GREEN}${BOLD}Verification of Applied Settings:${NC}"
echo -e "${GREEN}${BOLD}---------------------------------------------------------${NC}"

echo -e "Core Privacy Settings:"
echo -e "  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: $(get_setting CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC)"
echo -e "  DISABLE_TELEMETRY: $(get_setting DISABLE_TELEMETRY)"
echo -e "  DISABLE_ERROR_REPORTING: $(get_setting DISABLE_ERROR_REPORTING)"
echo -e "  includeCoAuthoredBy: $(get_setting includeCoAuthoredBy)"

echo -e "\nChat Transcript Retention Settings:"
echo -e "  cleanupPeriodDays: $(get_setting cleanupPeriodDays)"

echo -e "${GREEN}${BOLD}---------------------------------------------------------${NC}"
echo -e "${GREEN}${BOLD}Full Updated Settings File Content:${NC}"
echo -e "${GREEN}${BOLD}---------------------------------------------------------${NC}"
jq . "$CLAUDE_SETTINGS_FILE" # Pretty print the entire updated JSON file
echo -e "${GREEN}${BOLD}---------------------------------------------------------${NC}"

echo "Note: Some settings, especially those starting with CLAUDE_CODE_, may also be controllable via environment variables."
echo "Environment variables typically override settings in settings.json."
echo "For enterprise deployments, managed policy settings may also take precedence."