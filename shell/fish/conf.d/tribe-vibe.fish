# tribe-vibe history integration (managed by tribe-vibe)
# Delete all matching entries already loaded into this Fish session.
function __tribe_vibe_remove_history
    for command_name in tv tribe-vibe
        set -l entries (builtin history search --prefix "$command_name")
        for entry in $entries
            if string match --quiet --regex "^$command_name([[:space:]]|\$)" -- "$entry"
                builtin history delete --exact --case-sensitive "$entry"
            end
        end
    end
end

# Fish loads user configuration during startup. Also repeat the cleanup on the
# first prompt so it runs after startup history has been loaded, before input
# can produce an autosuggestion.
function __tribe_vibe_clear_history_on_startup --on-event fish_prompt
    __tribe_vibe_remove_history
    functions --erase __tribe_vibe_clear_history_on_startup
end

# Fish records commands before executing them. Remove each new invocation and
# all older entries again so none can return in a later session.
function __tribe_vibe_clear_history_before_command --on-event fish_preexec
    if string match --quiet --regex '^[[:space:]]*(tv|tribe-vibe)([[:space:]]|$)' -- "$argv[1]"
        __tribe_vibe_remove_history
    end
end

__tribe_vibe_remove_history
