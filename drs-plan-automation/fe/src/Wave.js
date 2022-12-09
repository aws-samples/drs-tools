import {useEffect, useState} from "react";
import empty_wave from "./data/wave";


const Wave = ({
                              wave,
                              setWave,
                          }) => {
    const [name, setName] = useState(empty_wave.Name);
    const [description, setDescription] = useState(empty_wave.Description);
    const [keyName, setKeyName] = useState(empty_wave.KeyName);
    const [keyValue, setKeyValue] = useState(empty_wave.KeyValue);
    const [maxWaitTime, setMaxWaitTime] = useState(empty_wave.MaxWaitTime);
    const [updateTime, setUpdateTime] = useState(empty_wave.UpdateTime);

    const [preWaveActions, setPreWaveActions] = useState(empty_wave.PreWaveActions);
    const [postWaveActions, setPostWaveActions] = useState(empty_wave.PreWaveActions);

    useEffect(() => {
        try {
            setName(wave.Name);
            setDescription(wave.Description);
            setKeyName(wave.KeyName);
            setKeyValue(wave.KeyValue);
            setMaxWaitTime(wave.MaxWaitTime);
            setUpdateTime(wave.UpdateTime);
            setPreWaveActions(wave.PreWaveActions);
            setPostWaveActions(wave.PostWaveActions);
            console.log("wave is: " + JSON.stringify(wave))
        } catch (err) {
            console.log('error setting new wave' + err)
        }
    }, [JSON.stringify(wave)]);



}
export default Wave;