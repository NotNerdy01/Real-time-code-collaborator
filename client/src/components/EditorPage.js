import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "@monaco-editor/react";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import './MainPage.css';
import { useNavigate, useLocation, Navigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import Navbar from './Navbar';
import Axios from 'axios';
import spinner from './spinner.svg';

function EditorPage() {
  const [userCode, setUserCode] = useState('');
  const [userLang, setUserLang] = useState("python");
  const [userTheme, setUserTheme] = useState("vs-dark");
  const [fontSize, setFontSize] = useState(20);
  const [userInput, setUserInput] = useState("");
  const [userOutput, setUserOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const codeRef = useRef(''); // Keep the latest code in this ref
  const editorRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const socketRef = useRef(null);

  const options = {
    fontSize: fontSize
  };

  function compile() {
    setLoading(true);
    if (userCode === '') return;

    Axios.post(`http://localhost:8000/compile`, {
      code: userCode,
      language: userLang,
      input: userInput
    }).then((res) => {
      setUserOutput(res.data.stdout || res.data.stderr);
    }).finally(() => {
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setUserOutput("Error: " + (err.response ? err.response.data.error : err.message));
      setLoading(false);
    });
  }

  function clearOutput() {
    setUserOutput("");
  }

  useEffect(() => {
    const handleErrors = (err) => {
      console.log("Error", err);
      toast.error("Socket connection failed, Try again later");
      navigate("/");
    };

    const init = async () => {
      socketRef.current = await initSocket();
      
      socketRef.current.on("connect_error", handleErrors);
      socketRef.current.on("connect_failed", handleErrors);

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
        if (username !== location.state?.username) {
          toast.success(`${username} joined the room.`);
        }
        setClients(clients);

        // Sync the latest code when a new user joins
        socketRef.current.emit(ACTIONS.SYNC_CODE, {
          code: codeRef.current,
          socketId,
        });
      });

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => prev.filter((client) => client.socketId !== socketId));
      });

      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        // Update the editor content when a change is received from another user
        if (editorRef.current && code !== codeRef.current) {
          codeRef.current = code;
          editorRef.current.setValue(code);
        }
      });
    };
    init();

    return () => {
      socketRef.current && socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    };
  }, [location.state?.username, navigate, roomId]);

  if (!location.state) {
    return <Navigate to="/" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(`Room ID is copied`);
    } catch (error) {
      console.log(error);
      toast.error("Unable to copy the Room ID");
    }
  };

  const leaveRoom = async () => {
    navigate("/");
  };

  const handleEditorChange = (value) => {
    codeRef.current = value; // Update the latest code
    socketRef.current.emit(ACTIONS.CODE_CHANGE, {
      roomId,
      code: value,
    });
  };

  return (
    <div className="main-container">
      <Navbar
        userLang={userLang} setUserLang={setUserLang}
        userTheme={userTheme} setUserTheme={setUserTheme}
        fontSize={fontSize} setFontSize={setFontSize}
      />
      <div className="main">
        <div className="left-container">
          <div
            className="bg-dark text-light d-flex flex-column h-100"
            style={{ boxShadow: "2px 0px 4px rgba(0, 0, 0, 0.1)" }}
          >
            <img
              src="/images/codecast.png"
              alt="Logo"
              className="img-fluid mx-auto"
              style={{ maxWidth: "150px", marginTop: "-43px" }}
            />
            <hr style={{ marginTop: "-3rem" }} />
            <div className="d-flex flex-column flex-grow-1 overflow-auto">
              <span className="mb-2">Members</span>
              {clients.map((client) => (
                <Client key={client.socketId} username={client.username} />
              ))}
            </div>
            <hr />
            <div className="mt-auto">
              <button className="btn btn-success" onClick={copyRoomId}>
                Copy Room ID
              </button>
              <button
                className="btn btn-danger mt-2 mb-2 px-3 btn-block"
                onClick={leaveRoom}
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
       
        <div className="middle-container">
          <Editor
            options={options}
            height="calc(100vh - 50px)"
            width="100%"
            theme={userTheme}
            language={userLang}
            defaultLanguage="python"
            defaultValue="# Enter your code here"
            onChange={handleEditorChange}
            onMount={(editor) => (editorRef.current = editor)}
          />
          <button className="run-btn" onClick={compile}>
            Run
          </button>
        </div>
        
        <div className="right-container">
          <h4>Input:</h4>
          <div className="input-box">
            <textarea id="code-inp" onChange={(e) => setUserInput(e.target.value)} />
          </div>
          <h4>Output:</h4>
          {loading ? (
            <div className="spinner-box">
              <img src={spinner} alt="Loading..." />
            </div>
          ) : (
            <div className="output-box">
              <pre>{userOutput}</pre>
              <button onClick={clearOutput} className="clear-btn">
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
