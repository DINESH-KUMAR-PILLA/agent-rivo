# Audio development samples

Four synthetic English recordings are included. Each has a 16 kHz mono PCM WAV file, an Ogg/Opus variant and its exact generation script. The manifest records durations and hashes. The WAV and Ogg versions contain the same speech; do not treat them as separate observations in the mixed example.

Process the actual audio with your chosen speech recogniser. Compare the transcript with the script for debugging, but never use the filename or script as the transcription implementation. Names, numbers and uncertainty should be preserved or clarified.

These clear synthetic recordings do not prove robustness to every accent, background noise or real phone encoding. The mandatory demonstration includes a freshly recorded voice note sent from WhatsApp. A normal file sent as an attachment may have different provider metadata from a native voice note; test the latter.

For audio-failure tests, use a private test stub that returns an error, a silent/invalid file or a controlled delayed response. A silent recording should not create a confident observation. No paid audio generation service was used to create these samples.
