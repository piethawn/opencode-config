-- Export Apple Reminders to JSON (Fixed: accesses lists by name to avoid AppleScript compound-object errors)
-- Usage: osascript /Users/labadmin/.config/opencode/scripts/reminders_export.scpt
-- Output: /tmp/opencode_reminders.json

set jsonObjects to {}
set reminderCount to 0

tell application "Reminders"
    try
        set listNames to name of every list
        repeat with lnameRef in listNames
            try
                set lname to lnameRef as string
                set currentList to list lname
                repeat with r in (reminders of currentList whose completed is false)
                    set rName to name of r
                    
                    set rDue to "null"
                    try
                        if due date of r is not missing value then
                            set rDue to "\"" & (due date of r as string) & "\""
                        end if
                    end try
                    
                    set rBody to ""
                    try
                        if body of r is not missing value then
                            set rBody to body of r
                        end if
                    end try
                    
                    set rPriority to priority of r as integer
                    
                    -- Build one JSON object as text
                    set obj to "{"
                    set obj to obj & "\"list\": \"" & my escapeJSON(lname) & "\","
                    set obj to obj & "\"name\": \"" & my escapeJSON(rName) & "\","
                    set obj to obj & "\"dueDate\": " & rDue & ","
                    set obj to obj & "\"priority\": " & rPriority & ","
                    set obj to obj & "\"description\": \"" & my escapeJSON(rBody) & "\""
                    set obj to obj & "}"
                    
                    set end of jsonObjects to obj
                    set reminderCount to reminderCount + 1
                end repeat
            on error
                -- skip inaccessible list
            end try
        end repeat
    on error errMsg
        return "ERROR: " & errMsg
    end try
end tell

-- Combine lines into final JSON
set outputText to "{" & return
set outputText to outputText & "  \"success\": true," & return
set outputText to outputText & "  \"count\": " & reminderCount & "," & return
set outputText to outputText & "  \"reminders\": [" & return

set lineCount to count of jsonObjects
repeat with j from 1 to lineCount
    set outputText to outputText & "    " & (item j of jsonObjects)
    if j < lineCount then
        set outputText to outputText & ","
    end if
    set outputText to outputText & return
end repeat

set outputText to outputText & "  ]" & return
set outputText to outputText & "}" & return

-- Write to file
set outPath to "/tmp/opencode_reminders.json"
try
    set fileRef to open for access POSIX file outPath with write permission
    set eof of fileRef to 0
    write outputText to fileRef
    close access fileRef
on error
    close access POSIX file outPath
end try

return "OK: " & reminderCount & " reminders exported to " & outPath

-- JSON escaping helpers
on escapeJSON(str)
    set str to my replaceAll(str, "\\", "\\\\")
    set str to my replaceAll(str, "\"", "\\\"")
    set str to my replaceAll(str, return, "\\n")
    set str to my replaceAll(str, "\n", "\\n")
    set str to my replaceAll(str, "\r", "\\r")
    set str to my replaceAll(str, tab, "\\t")
    return str
end escapeJSON

on replaceAll(source, find, replace)
    set oldDelims to AppleScript's text item delimiters
    set AppleScript's text item delimiters to find
    set textItems to text items of source
    set AppleScript's text item delimiters to replace
    set resultText to textItems as string
    set AppleScript's text item delimiters to oldDelims
    return resultText
end replaceAll
