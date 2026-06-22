(*
  Quick check: counts incomplete reminders by list and returns a compact JSON summary.
  Usage:
    osascript /Users/labadmin/.config/opencode/scripts/reminders_count.scpt
  Output: /tmp/opencode_reminders_summary.json
*)

tell application "Reminders"
    set summary to {}
    set totalCount to 0
    
    try
        repeat with alist in lists
            try
                set listName to name of alist
                set listReminders to (reminders of alist whose completed is false)
                set listCount to count of listReminders
                if listCount > 0 then
                    set end of summary to {listName:listName, count:listCount}
                    set totalCount to totalCount + listCount
                end if
            on error
                -- Ignore inaccessible or empty lists
            end try
        end repeat
        
        set scriptOutput to "{ \"success\": true, \"total\": " & totalCount & ", \"lists\": ["
        set firstItem to true
        repeat with itemDict in summary
            if not firstItem then
                set scriptOutput to scriptOutput & ", "
            end if
            set firstItem to false
            set scriptOutput to scriptOutput & "{\"list\": \"" & escapeJson(listName of itemDict) & "\", \"count\": " & (count of itemDict) & "}"
        end repeat
        set scriptOutput to scriptOutput & "] }" & return
        
        set outputPath to "/tmp/opencode_reminders_summary.json"
        set fileDescriptor to open for access POSIX file outputPath with write permission
        set eof of fileDescriptor to 0
        write scriptOutput to fileDescriptor
        close access fileDescriptor
        
        return "EXPORTED_TO_" & outputPath
    on error errMsg
        try
            close access POSIX file ("/tmp/opencode_reminders_summary.json")
        end try
        return "ERROR: " & errMsg
    end try
end tell

on escapeJson(str)
    set str to my replaceText(str, "\\", "\\\\")
    set str to my replaceText(str, "\"", "\\\"")
    set str to my replaceText(str, return, "\\n")
    set str to my replaceText(str, "\n", "\\n")
    return str
end escapeJson

on replaceText(sourceText, find, replace)
    set delimiters to AppleScript's text item delimiters
    set AppleScript's text item delimiters to find
    set sourceText to text items of sourceText
    set AppleScript's text item delimiters to replace
    set sourceText to sourceText as text
    set AppleScript's text item delimiters to delimiters
    return sourceText
end replaceText
